import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { Storage } from '@lib/enums/Storage'
import { createMMKVStorage } from '@lib/storage/MMKV'
import { getNetworkNow } from '@lib/utils/NetworkTime'

export type DeveloperContactStatus = 'none' | 'prompted' | 'accepted' | 'rejected'

type DeveloperContactState = {
    status: DeveloperContactStatus
    acceptedAt?: number
    messageSent: boolean
    tutorialSent: boolean
    disclaimerSent: boolean
    pureLoveWarningSent: boolean
    unlockMessageSent: boolean
    unlockMessageAt?: number
    read: boolean
    warnings: number
    lastWarningAt?: number
    request: () => void
    accept: () => void
    reject: () => void
    sendPureLoveWarning: () => void
    sendUnlockSurprise: () => void
    markRead: () => void
    reset: () => void
}

export const useDeveloperContactStore = create<DeveloperContactState>()(
    persist(
        (set, get) => ({
            status: 'none',
            acceptedAt: undefined,
            messageSent: false,
            tutorialSent: false,
            disclaimerSent: false,
            pureLoveWarningSent: false,
            unlockMessageSent: false,
            unlockMessageAt: undefined,
            read: false,
            warnings: 0,
            lastWarningAt: undefined,
            request: () => {
                if (get().status === 'accepted' || get().status === 'rejected') return
                set({ status: 'prompted' })
            },
            accept: () => {
                if (get().status === 'accepted') return
                set({
                    status: 'accepted',
                    acceptedAt: getNetworkNow(),
                    messageSent: true,
                    tutorialSent: true,
                    disclaimerSent: true,
                    pureLoveWarningSent: false,
                    read: false,
                })
            },
            reject: () => {
                if (get().status === 'accepted') return
                set({ status: 'rejected' })
            },
            sendPureLoveWarning: () => {
                set((state) => ({
                    status: 'accepted',
                    acceptedAt: state.acceptedAt ?? getNetworkNow(),
                    messageSent: true,
                    tutorialSent: true,
                    disclaimerSent: true,
                    pureLoveWarningSent: true,
                    read: false,
                    warnings: state.warnings + 1,
                    lastWarningAt: getNetworkNow(),
                }))
            },
            sendUnlockSurprise: () => {
                const now = getNetworkNow()
                set((state) => {
                    if (state.unlockMessageSent) return state
                    return {
                        status: 'accepted',
                        acceptedAt: state.acceptedAt ?? now,
                        unlockMessageSent: true,
                        unlockMessageAt: now,
                        read: false,
                    }
                })
            },
            markRead: () => set({ read: true }),
            reset: () =>
                set({
                    status: 'none',
                    acceptedAt: undefined,
                    messageSent: false,
                    tutorialSent: false,
                    disclaimerSent: false,
                    pureLoveWarningSent: false,
                    unlockMessageSent: false,
                    unlockMessageAt: undefined,
                    read: false,
                    warnings: 0,
                    lastWarningAt: undefined,
                }),
        }),
        {
            name: Storage.DeveloperContact,
            storage: createMMKVStorage(),
            version: 4,
            migrate: (persistedState: any) => ({
                ...persistedState,
                tutorialSent: persistedState?.tutorialSent ?? persistedState?.messageSent ?? false,
                disclaimerSent:
                    persistedState?.disclaimerSent ?? persistedState?.messageSent ?? false,
                pureLoveWarningSent:
                    persistedState?.pureLoveWarningSent ?? (persistedState?.warnings ?? 0) > 0,
                unlockMessageSent: persistedState?.unlockMessageSent ?? false,
                unlockMessageAt: persistedState?.unlockMessageAt,
                warnings: persistedState?.warnings ?? 0,
                lastWarningAt: persistedState?.lastWarningAt,
            }),
        }
    )
)
