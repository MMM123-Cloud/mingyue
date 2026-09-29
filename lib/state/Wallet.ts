import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { useDeveloperModeStore } from '@lib/state/DeveloperMode'
import { getNetworkDate, getNetworkNow } from '@lib/utils/NetworkTime'
import { Storage } from '@lib/enums/Storage'
import { createMMKVStorage } from '@lib/storage/MMKV'

export type WalletRecord = {
    id: string
    amount: number
    note: string
    direction: 'send' | 'receive' | 'recharge' | 'grant' | 'refund'
    characterId?: number
    characterName?: string
    createdAt: number
}

type WalletState = {
    balance: number
    aiBalances: Record<string, number>
    records: WalletRecord[]
    lastMonthlyGrant: string
    transferToAI: (
        amount: number,
        note: string,
        characterId: number,
        characterName: string
    ) => boolean
    receiveFromAI: (
        amount: number,
        note: string,
        characterId: number,
        characterName: string
    ) => boolean
    receiveGiftFromAI: (
        amount: number,
        note: string,
        characterId: number,
        characterName: string
    ) => boolean
    ensureMonthlyAllowance: () => void
    recharge: () => boolean
    deleteCharacter: (characterId: number) => void
    resetWallet: () => void
}

const startBalance = 10000
const monthlyAllowance = 10000

const getMonthKey = (date = getNetworkDate()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const useWalletStore = create<WalletState>()(
    persist(
        (set, get) => ({
            balance: startBalance,
            aiBalances: {},
            records: [],
            lastMonthlyGrant: getMonthKey(),
            transferToAI: (amount, note, characterId, characterName) => {
                amount = Math.round((amount + Number.EPSILON) * 100) / 100
                const developerMode = useDeveloperModeStore.getState().enabled
                if (!Number.isFinite(amount) || amount <= 0) return false
                if (!developerMode && amount > get().balance) return false
                const key = String(characterId)
                set({
                    balance: developerMode
                        ? get().balance
                        : Number((get().balance - amount).toFixed(2)),
                    aiBalances: {
                        ...get().aiBalances,
                        [key]: Number(((get().aiBalances[key] ?? 0) + amount).toFixed(2)),
                    },
                    records: [
                        {
                            id: `${getNetworkNow()}-${Math.random()}`,
                            amount,
                            note,
                            direction: 'send',
                            characterId,
                            characterName,
                            createdAt: getNetworkNow(),
                        },
                        ...get().records,
                    ],
                })
                return true
            },
            receiveFromAI: (amount, note, characterId, characterName) => {
                amount = Math.round((amount + Number.EPSILON) * 100) / 100
                const key = String(characterId)
                const aiBalance = get().aiBalances[key] ?? 0
                if (!Number.isFinite(amount) || amount <= 0 || amount > aiBalance) return false
                set({
                    balance: Number((get().balance + amount).toFixed(2)),
                    aiBalances: {
                        ...get().aiBalances,
                        [key]: Number((aiBalance - amount).toFixed(2)),
                    },
                    records: [
                        {
                            id: `${getNetworkNow()}-${Math.random()}`,
                            amount,
                            note,
                            direction: 'receive',
                            characterId,
                            characterName,
                            createdAt: getNetworkNow(),
                        },
                        ...get().records,
                    ],
                })
                return true
            },
            receiveGiftFromAI: (amount, note, characterId, characterName) => {
                amount = Math.round((amount + Number.EPSILON) * 100) / 100
                if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) return false
                set({
                    balance: Number((get().balance + amount).toFixed(2)),
                    records: [
                        {
                            id: `${getNetworkNow()}-${Math.random()}`,
                            amount,
                            note,
                            direction: 'receive',
                            characterId,
                            characterName,
                            createdAt: getNetworkNow(),
                        },
                        ...get().records,
                    ],
                })
                return true
            },
            ensureMonthlyAllowance: () => {
                const month = getMonthKey()
                if (get().lastMonthlyGrant === month) return
                set({
                    balance: Number((get().balance + monthlyAllowance).toFixed(2)),
                    lastMonthlyGrant: month,
                    records: [
                        {
                            id: `${getNetworkNow()}-${Math.random()}`,
                            amount: monthlyAllowance,
                            note: '每月本地模拟补贴',
                            direction: 'grant',
                            createdAt: getNetworkNow(),
                        },
                        ...get().records,
                    ],
                })
            },
            recharge: () => {
                if (!useDeveloperModeStore.getState().enabled) return false
                const amount = 1000
                set({
                    balance: Number((get().balance + amount).toFixed(2)),
                    records: [
                        {
                            id: `${getNetworkNow()}-${Math.random()}`,
                            amount,
                            note: '开发者模式加钱（无限）',
                            direction: 'recharge',
                            createdAt: getNetworkNow(),
                        },
                        ...get().records,
                    ],
                })
                return true
            },
            deleteCharacter: (characterId) => {
                const key = String(characterId)
                const aiBalance = get().aiBalances[key] ?? 0
                const aiBalances = { ...get().aiBalances }
                delete aiBalances[key]
                const remainingRecords = get().records.filter(
                    (item) => item.characterId !== characterId
                )
                const refundRecord =
                    aiBalance > 0
                        ? [
                              {
                                  id: `${getNetworkNow()}-${Math.random()}`,
                                  amount: aiBalance,
                                  note: '联系人注销，余额已退回',
                                  direction: 'refund' as const,
                                  characterId,
                                  createdAt: getNetworkNow(),
                              },
                          ]
                        : []
                set({
                    balance: Number((get().balance + aiBalance).toFixed(2)),
                    aiBalances,
                    records: [...refundRecord, ...remainingRecords],
                })
            },
            resetWallet: () =>
                set({
                    balance: startBalance,
                    aiBalances: {},
                    records: [],
                    lastMonthlyGrant: getMonthKey(),
                }),
        }),
        {
            name: Storage.Wallet,
            storage: createMMKVStorage(),
            version: 4,
            migrate: (persistedState: any) => ({
                ...persistedState,
                balance: Number(
                    Math.max(
                        0,
                        Number.isFinite(persistedState?.balance)
                            ? persistedState.balance
                            : startBalance
                    ).toFixed(2)
                ),
                records: persistedState?.records ?? [],
                aiBalances: persistedState?.aiBalances ?? {},
                lastMonthlyGrant: persistedState?.lastMonthlyGrant ?? '',
            }),
        }
    )
)
