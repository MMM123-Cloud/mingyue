import { getDocumentAsync } from 'expo-document-picker'
import { t } from 'i18next'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import {
    defaultSamplerConfig,
    SamplerConfigData,
    SamplerID,
    Samplers,
} from '@lib/constants/SamplerData'
import { Storage } from '@lib/enums/Storage'
import { Logger } from '@lib/state/Logger'
import { createMMKVStorage } from '@lib/storage/MMKV'
import { readStringAsync } from '@lib/utils/File'

import { CharacterLink } from './CharacterLinks'

export type SamplerConfig = {
    name: string
    data: SamplerConfigData
}

export type SamplerStateProps = {
    currentConfigIndex: number
    configList: SamplerConfig[]
    updateCurrentConfig: (preset: SamplerConfig) => void
    addSamplerConfig: (preset: SamplerConfig) => void
    deleteSamplerConfig: (index: number) => void
    setConfig: (index: number) => void
    fixConfigs: () => void
}

export namespace SamplersManager {
    export const useSamplerStore = create<SamplerStateProps>()(
        persist(
            (set, get) => ({
                currentConfigIndex: 0,
                configList: [{ name: 'Default', data: defaultSamplerConfig }],
                addSamplerConfig: (config) => {
                    const configs = get().configList
                    if (configs.some((item) => item.name === config.name)) {
                        Logger.errorToast(t('sampler.toast.exists', { name: config.name }))
                        return
                    }
                    config.data = fixSamplerConfig(config.data)
                    set((state) => ({
                        configList: [...state.configList, config],
                        currentConfigIndex: state.configList.length,
                    }))
                },
                deleteSamplerConfig: (index) => {
                    CharacterLink.db.mutate.deleteByValue('sampler_index', index)
                    set((state) => ({
                        configList: state.configList.filter((item, i) => i !== index),
                        currentConfigIndex:
                            index === state.currentConfigIndex ? 0 : state.currentConfigIndex,
                    }))
                },
                setConfig: (index) => {
                    const maxLength = get().configList.length
                    if (index >= maxLength || index < 0) {
                        return
                    }
                    set({ currentConfigIndex: index })
                },
                updateCurrentConfig: (config) => {
                    const configs = get().configList
                    const index = get().currentConfigIndex
                    configs[index] = config
                    set({ configList: [...configs] })
                },
                fixConfigs: () => {
                    set((state) => ({
                        configList: state.configList.map((item) => ({
                            name: item.name,
                            data: fixSamplerConfig(item.data),
                        })),
                    }))
                },
            }),
            {
                name: Storage.Samplers,
                storage: createMMKVStorage(),
                version: 4,
                partialize: (state) => ({
                    configList: state.configList,
                    currentConfigIndex: state.currentConfigIndex,
                }),
                migrate: async (persistedState: any, version) => {
                    if (version < 2) {
                        const configList: SamplerConfig[] = persistedState.configList ?? []
                        persistedState.configList = configList.map((item) => ({
                            ...item,
                            data: {
                                ...fixSamplerConfig(item.data ?? {}),
                                [SamplerID.GENERATED_LENGTH]: Math.max(
                                    item.data?.[SamplerID.GENERATED_LENGTH] ?? 256,
                                    256
                                ),
                                [SamplerID.TEMPERATURE]: 0.8,
                                [SamplerID.TOP_P]: 0.92,
                                [SamplerID.TOP_K]: 40,
                                [SamplerID.MIN_P]: 0.05,
                                [SamplerID.REPETITION_PENALTY]: 1.12,
                                [SamplerID.REPETITION_PENALTY_RANGE]: 256,
                                [SamplerID.PRESENCE_PENALTY]: 0.1,
                                [SamplerID.FREQUENCY_PENALTY]: 0.05,
                                [SamplerID.SEED]: -1,
                            },
                        }))
                        Logger.info('Migrated to v2 Samplers: stable chat sampling profile')
                    }
                    if (version < 3) {
                        const configList: SamplerConfig[] = persistedState.configList ?? []
                        persistedState.configList = configList.map((item) => ({
                            ...item,
                            data: {
                                ...fixSamplerConfig(item.data ?? {}),
                                [SamplerID.GENERATED_LENGTH]: Math.max(
                                    item.data?.[SamplerID.GENERATED_LENGTH] ?? 256,
                                    256
                                ),
                                [SamplerID.TEMPERATURE]: 0.8,
                                [SamplerID.TOP_P]: 0.9,
                                [SamplerID.TOP_K]: 20,
                                [SamplerID.MIN_P]: 0.05,
                                [SamplerID.REPETITION_PENALTY]: 1.2,
                                [SamplerID.REPETITION_PENALTY_RANGE]: 512,
                                [SamplerID.PRESENCE_PENALTY]: 0.12,
                                [SamplerID.FREQUENCY_PENALTY]: 0.06,
                                [SamplerID.SEED]: -1,
                            },
                        }))
                        Logger.info('Migrated to v3 Samplers: anti-repeat chat sampling profile')
                    }
                    if (version < 4) {
                        const configList: SamplerConfig[] = persistedState.configList ?? []
                        persistedState.configList = configList.map((item) => ({
                            ...item,
                            data: {
                                ...fixSamplerConfig(item.data ?? {}),
                                [SamplerID.DRY_MULTIPLIER]: 0.8,
                                [SamplerID.DRY_BASE]: 1.75,
                                [SamplerID.DRY_ALLOWED_LENGTH]: 3,
                                [SamplerID.DRY_PENALTY_LAST_N]: 512,
                                [SamplerID.DRY_SEQUENCE_BREAK]: '\n,:,",*,。',
                            },
                        }))
                        Logger.info('Migrated to v4 Samplers: DRY anti-repeat profile')
                    }
                    return persistedState
                },
            }
        )
    )

    export const useSamplers = () => {
        const {
            currentPresetIndex: currentConfigIndex,
            samplerConfigs,
            addSamplerConfig,
            deleteSamplerConfig,
            changeConfig,
            updateCurrentConfig,
            configList,
        } = useSamplerStore(
            useShallow((state) => ({
                currentPresetIndex: state.currentConfigIndex,
                samplerConfigs: state.configList,
                addSamplerConfig: state.addSamplerConfig,
                deleteSamplerConfig: state.deleteSamplerConfig,
                changeConfig: state.setConfig,
                updateCurrentConfig: state.updateCurrentConfig,
                configList: state.configList,
            }))
        )

        const currentConfig = samplerConfigs[currentConfigIndex]

        return {
            currentConfigIndex,
            addSamplerConfig,
            deleteSamplerConfig,
            changeConfig,
            updateCurrentConfig,
            currentConfig,
            configList,
        }
    }

    export function getCurrentSampler() {
        return useSamplerStore.getState().configList[useSamplerStore.getState().currentConfigIndex]
            .data
    }

    export function useCurrentSampler(): SamplerConfig | undefined {
        const { currentConfigIndex, configList } = useSamplers()
        return configList?.[currentConfigIndex]
    }

    export async function importConfigFile(): Promise<SamplerConfig | undefined> {
        try {
            const result = await getDocumentAsync({ type: ['application/*'] })
            if (
                result.canceled ||
                (!result.assets[0].name.endsWith('json') &&
                    !result.assets[0].name.endsWith('settings'))
            ) {
                Logger.errorToast(t('common.errors.invalidFileType'))
                return
            }
            const {
                assets: [asset],
            } = result
            const name = asset.name.replace(`.json`, '').replace('.settings', '').replace(' ', '_')
            const data = await readStringAsync(asset.uri)

            return { data: JSON.parse(data), name: name }
        } catch (e) {
            Logger.errorToast(t('sampler.toast.failedToImport'), e)
        }
    }
}

export function fixSamplerConfig(config: SamplerConfigData) {
    const existingKeys = Object.keys(config)
    const defaultKeys = Object.values(SamplerID) as SamplerID[]
    let samekeys = true
    defaultKeys.map((key) => {
        if (key === SamplerID.SEED && typeof config[key] === 'string')
            config[key] = parseInt(config[key])
        if (existingKeys.includes(key)) return
        const data = Samplers[key].values.default
        //@ts-expect-error needs more coercion, but probably fine
        config[key] = data
        samekeys = false
        Logger.debug(`Sampler Config was missing field: ${key}`)
    })
    if (!samekeys) Logger.warn(`Sampler Config had missing fields and was fixed!`)
    return config
}
