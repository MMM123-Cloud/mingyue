import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createMMKVStorage } from '@lib/storage/MMKV'

export const DEVELOPER_UNLOCK_PHRASE = '把月亮停靠在第七码头'

type DeveloperModeState = {
    enabled: boolean
    unlockWithPhrase: (input: string) => boolean
    setEnabled: (enabled: boolean) => void
}

export const useDeveloperModeStore = create<DeveloperModeState>()(
    persist(
        (set) => ({
            enabled: false,
            unlockWithPhrase: (input) => {
                if (input.trim() !== DEVELOPER_UNLOCK_PHRASE) return false
                set({ enabled: true })
                return true
            },
            setEnabled: (enabled) => set({ enabled }),
        }),
        {
            name: 'mingyue-developer-mode',
            storage: createMMKVStorage(),
        }
    )
)
