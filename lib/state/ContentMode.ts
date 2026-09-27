import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ContentMode } from '@lib/constants/ContentRules'
import { Storage } from '@lib/enums/Storage'
import { createMMKVStorage } from '@lib/storage/MMKV'

export type ContentModePreference = 'auto' | ContentMode

type ContentModeState = {
    preference: ContentModePreference
    setPreference: (preference: ContentModePreference) => void
}

export const useContentModeStore = create<ContentModeState>()(
    persist(
        (set) => ({
            preference: 'auto',
            setPreference: (preference) => set({ preference }),
        }),
        {
            name: Storage.ContentMode,
            storage: createMMKVStorage(),
        }
    )
)

export const isAdultModelName = (name?: string) =>
    !!name &&
    /(?:abliterated|uncensored|nsfw|adult|unfiltered|无审查|未审查|成人|破限|解除限制|本地包)/i.test(
        name
    )

export const getContentModeForModel = (name?: string): ContentMode =>
    isAdultModelName(name) ? 'adult' : 'safe'

export const getPreferredContentMode = (modelName?: string): ContentMode => {
    const preference = useContentModeStore.getState().preference
    if (preference !== 'auto') return preference
    return getContentModeForModel(modelName)
}
