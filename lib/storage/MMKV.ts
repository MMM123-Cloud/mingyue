import { createMMKV } from 'react-native-mmkv'
import { createJSONStorage, StateStorage } from 'zustand/middleware'

export const mmkv = createMMKV()

export const mmkvStorage: StateStorage = {
    setItem: (name, value) => {
        return mmkv.set(name, value)
    },
    getItem: (name) => {
        const value = mmkv.getString(name)
        return value ?? null
    },
    removeItem: (name) => {
        return mmkv.remove(name)
    },
}

export const createMMKVStorage = () => {
    return createJSONStorage(() => mmkvStorage)
}
