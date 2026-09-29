jest.mock('@lib/storage/MMKV', () => ({
    createMMKVStorage: () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} }),
}))
jest.mock('@lib/state/DeveloperMode', () => ({
    useDeveloperModeStore: { getState: () => ({ enabled: false }) },
}))
jest.mock('@lib/utils/NetworkTime', () => ({
    getNetworkNow: () => Date.UTC(2026, 8, 28),
    getNetworkDate: () => new Date(Date.UTC(2026, 8, 28)),
}))

import { useWalletStore } from '../lib/state/Wallet'

beforeEach(() => useWalletStore.getState().resetWallet())
test('rejects tiny, invalid and overdrawn transfers without changing balances', () => {
    const wallet = useWalletStore.getState()
    for (const amount of [0.001, 0, -1, Infinity, NaN, 10001]) {
        expect(wallet.transferToAI(amount, '', 1, '测试联系人')).toBe(false)
    }
    expect(useWalletStore.getState().balance).toBe(10000)
    expect(useWalletStore.getState().records).toHaveLength(0)
})
test('rounds to cents and conserves the combined user and contact balances', () => {
    expect(useWalletStore.getState().transferToAI(1.005, '', 1, '测试联系人')).toBe(true)
    let wallet = useWalletStore.getState()
    expect(wallet.balance).toBe(9998.99)
    expect(wallet.aiBalances['1']).toBe(1.01)
    expect(wallet.records[0].amount).toBe(1.01)
    expect(wallet.receiveFromAI(1.01, '', 1, '测试联系人')).toBe(true)
    wallet = useWalletStore.getState()
    expect(wallet.balance).toBe(10000)
    expect(wallet.aiBalances['1']).toBe(0)
})
test('deleting a contact refunds its remaining balance once', () => {
    useWalletStore.getState().transferToAI(10, '', 1, '测试联系人')
    useWalletStore.getState().deleteCharacter(1)
    useWalletStore.getState().deleteCharacter(1)
    expect(useWalletStore.getState().balance).toBe(10000)
})
