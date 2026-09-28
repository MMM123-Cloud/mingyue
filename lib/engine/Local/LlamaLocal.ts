import { closeFd, getContentFd } from '@vali98/react-native-fs'
import {
    CompletionParams,
    ContextParams,
    initLlama,
    LlamaContext,
    RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER,
} from 'cui-llama.rn'
import { t } from 'i18next'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ModelDataType } from '@db/schema'
import { Storage } from '@lib/enums/Storage'
import { AppDirectory, fileExists, readableFileSize, writeBase64File } from '@lib/utils/File'

import { checkGGMLDeprecated } from './GGML'
import { KV, Model } from './Model'
import { AppSettings, Global } from '../../constants/GlobalValues'
import { Logger } from '../../state/Logger'
import { createMMKVStorage, mmkv } from '../../storage/MMKV'

export type CompletionTimings = {
    predicted_per_token_ms: number
    predicted_per_second: number | null
    predicted_ms: number
    predicted_n: number

    prompt_per_token_ms: number
    prompt_per_second: number | null
    prompt_ms: number
    prompt_n: number
}

export type CompletionOutput = {
    text: string
    timings: CompletionTimings
}

export type LlamaState = {
    context: LlamaContext | undefined
    model?: ModelDataType
    mmproj?: ModelDataType
    loadProgress: number
    chatCount: number
    promptCache?: string
    load: (model: ModelDataType) => Promise<void>
    loadMmproj: (model: ModelDataType) => Promise<void>
    setLoadProgress: (progress: number) => void
    unload: () => Promise<void>
    unloadMmproj: () => Promise<void>
    saveKV: (prompt: string | undefined, media_paths?: string[]) => Promise<void>
    loadKV: () => Promise<boolean>
    completion: (
        params: CompletionParams,
        callback: (text: string) => void,
        completed: (text: string, timngs: CompletionTimings) => void
    ) => Promise<void>
    stopCompletion: () => Promise<void>
    tokenLength: (text: string, mediaPaths?: string[]) => Promise<number>
    tokenize: (text: string, media_paths?: string[]) => Promise<{ tokens: number[] } | undefined>
}

export type LlamaConfig = {
    context_length: number
    threads: number
    gpu_layers: number
    batch: number
    ctx_shift: boolean
    devices: string[]
}

export type EngineDataProps = {
    config: LlamaConfig
    lastModel?: ModelDataType
    lastMmproj?: ModelDataType
    setConfiguration: (config: LlamaConfig) => void
    setLastModelLoaded: (model: ModelDataType | undefined) => void
    setLastMmprojLoaded: (model: ModelDataType | undefined) => void
    maybeClearLastLoaded: (mode: ModelDataType) => void
}

const sessionFile = `${AppDirectory.SessionPath}llama-session.bin`

let activeModelLoad: Promise<void> | undefined
let activeModelLoadId: number | undefined
let activeCompletion: Promise<void> | undefined
let modelLoadGeneration = 0

const defaultConfig = {
    context_length: 2048,
    threads: 4,
    gpu_layers: 0,
    batch: 128,
    ctx_shift: true,
    devices: [],
}

const getFastRuntimeConfig = (model: ModelDataType, config: LlamaConfig): LlamaConfig => {
    const source = `${model.name} ${model.file} ${model.params}`.toLowerCase()
    const lightModel =
        model.file_size <= 3 * 1024 ** 3 ||
        /(?:^|[^0-9])(?:0[.]6|1[.]7|2|3|4)\s*b(?:[^a-z0-9]|$)/i.test(source)
    const veryHeavyModel =
        model.file_size >= 7 * 1024 ** 3 ||
        /(?:^|[^0-9])(?:14|32|70)\s*b(?:[^a-z0-9]|$)/i.test(source)
    const heavyModel =
        veryHeavyModel ||
        model.file_size >= 4 * 1024 ** 3 ||
        /(?:^|[^0-9])(?:8|9|12)\s*b(?:[^a-z0-9]|$)/i.test(source)

    if (lightModel)
        return {
            ...config,
            context_length: 2048,
            threads: Math.min(config.threads, 4),
            batch: 128,
        }
    if (!heavyModel) return config

    return {
        ...config,
        context_length: Math.min(config.context_length, veryHeavyModel ? 1536 : 2048),
        threads: Math.min(config.threads, 4),
        batch: 128,
    }
}

export namespace Llama {
    export const useLlamaPreferencesStore = create<EngineDataProps>()(
        persist(
            (set, get) => ({
                config: defaultConfig,
                setConfiguration: (config: LlamaConfig) => {
                    set({ config: config })
                },
                setLastModelLoaded: (model: ModelDataType | undefined) => {
                    if (get().lastModel?.id === model?.id) return
                    set({ lastModel: model, lastMmproj: undefined })
                },
                setLastMmprojLoaded: (mmproj: ModelDataType | undefined) => {
                    set({ lastMmproj: mmproj })
                },
                maybeClearLastLoaded: (data) => {
                    if (data.id === get().lastModel?.id) {
                        set({ lastModel: undefined, lastMmproj: undefined })
                    } else if (data.id === get().lastMmproj?.id) {
                        set({ lastMmproj: undefined })
                    }
                },
            }),
            {
                name: Storage.EngineData,
                partialize: (state) => ({
                    config: state.config,
                    lastModel: state.lastModel,
                    lastMmproj: state.lastMmproj,
                }),
                storage: createMMKVStorage(),
                version: 8,
                migrate: (persistedState: any, version) => {
                    if (version === 1) {
                        persistedState.config.ctx_shift = true
                        Logger.info('Migrated to v2 EngineData')
                    }
                    if (version === 2) {
                        persistedState.config.devices = []
                        Logger.info('Migrated to v3 EngineData')
                    }
                    if (version <= 3) {
                        const config = persistedState.config ?? {}
                        if (config.context_length === 4096) config.context_length = 3072
                        if (config.batch === 512) config.batch = 256
                        if (config.threads === 4) config.threads = 6
                        persistedState.config = config
                        Logger.info('Migrated to v4 EngineData')
                    }
                    if (version <= 4) {
                        const config = persistedState.config ?? {}
                        if (config.devices?.includes('GPUOpenCL')) {
                            config.gpu_layers = 0
                            config.devices = []
                        }
                        persistedState.config = config
                        Logger.info('Migrated to v5 EngineData: OpenCL disabled by default')
                    }
                    if (version <= 5) {
                        const config = persistedState.config ?? {}
                        config.context_length = Math.min(config.context_length ?? 2048, 2048)
                        config.threads = Math.min(config.threads ?? 4, 4)
                        config.batch = Math.min(config.batch ?? 128, 128)
                        config.gpu_layers = 0
                        config.devices = []
                        persistedState.config = config
                        Logger.info('Migrated to v6 EngineData: fast response profile')
                    }
                    if (version <= 6) {
                        const config = persistedState.config ?? {}
                        config.context_length = 4096
                        config.threads = Math.max(config.threads ?? 6, 6)
                        config.batch = Math.max(config.batch ?? 256, 256)
                        config.gpu_layers = 99
                        config.devices = ['GPUOpenCL']
                        persistedState.config = config
                        Logger.info('Migrated to v7 EngineData: 4096 context and OpenCL retry')
                    }
                    if (version <= 7) {
                        const config = persistedState.config ?? {}
                        config.context_length = Math.min(config.context_length ?? 2048, 2048)
                        config.threads = Math.min(config.threads ?? 4, 4)
                        config.batch = Math.min(config.batch ?? 128, 128)
                        config.gpu_layers = 0
                        config.devices = []
                        persistedState.config = config
                        Logger.info('Migrated to v8 EngineData: CPU-only stability profile')
                    }
                    return persistedState
                },
            }
        )
    )

    export const useLlamaModelStore = create<LlamaState>()((set, get) => ({
        context: undefined,
        loadProgress: 0,
        chatCount: 0,
        promptCache: undefined,
        load: async (model: ModelDataType) => {
            const storedConfig = useLlamaPreferencesStore.getState().config
            const config = getFastRuntimeConfig(model, storedConfig)
            if (config !== storedConfig) {
                useLlamaPreferencesStore.getState().setConfiguration(config)
                Logger.info('Applied fast runtime profile for current model')
            }

            let gpuLayers = config.gpu_layers ?? 0
            let devices = config.devices ?? []

            if (get().model?.id === model.id && get().context !== undefined) {
                return Logger.errorToast(t('model.toast.modelAlreadyLoaded'))
            }

            if (activeModelLoad && activeModelLoadId === model.id) {
                Logger.info(`Joining model load already in progress: ${model.name}`)
                return activeModelLoad
            }

            const generation = ++modelLoadGeneration
            const previousLoad = activeModelLoad
            const task = (async () => {
                if (previousLoad) await previousLoad.catch(() => undefined)
                if (generation !== modelLoadGeneration) {
                    Logger.info('Model load was superseded before it started')
                    return
                }

                if (get().model?.id === model.id && get().context !== undefined) return

                if (checkGGMLDeprecated(parseInt(model.quantization))) {
                    return Logger.errorToast(t('model.toast.quantizationNoLongerSupported'))
                }

                if (!(await Model.getModelExists(model.file_path))) {
                    Logger.errorToast(t('model.toast.modelDoesNotExist'))
                    Model.verifyModelList()
                    return
                }

                if (get().context !== undefined) {
                    if (get().mmproj) await get().context?.releaseMultimodal()
                    await get().context?.release()
                    set({ context: undefined, model: undefined, mmproj: undefined })
                }

                const progressCallback = (progress: number) => {
                    if (progress % 5 === 0) get().setLoadProgress(progress)
                }

                const tryLoad = async (nGpuLayers: number, targetDevices: string[]) => {
                    let model_path = model.file_path
                    if (model.file_path.includes('content://')) {
                        model_path = (await getContentFd(model_path)) ?? model_path
                    }

                    const params: ContextParams = {
                        model: model_path,
                        n_ctx: config.context_length,
                        n_threads: config.threads,
                        n_batch: config.batch,
                        n_parallel: 1,
                        ctx_shift: config.ctx_shift,
                        n_gpu_layers: nGpuLayers,
                        use_mlock: false,
                        use_mmap: true,
                        devices: targetDevices,
                    }

                    Logger.info(
                `\n------ MODEL LOAD -----\n Model Name: ${model.name}\nStarting with parameters: \nContext Length: ${params.n_ctx}\nThreads: ${params.n_threads}\nBatch Size: ${params.n_batch}\nGPU Layers: ${params.n_gpu_layers}\nDevices: ${params.devices?.join(', ') ?? 'CPU'}`
                    )

                    return initLlama(params, progressCallback).catch((error) => {
                        Logger.warn(`Model load failed: ${JSON.stringify(error)}`)
                        if (model.file_path.includes('content://')) {
                            closeFd(model_path)
                        }
                        return undefined
                    })
                }

                // Try GPU offload first when configured, then fall back to plain CPU. Some
                // Adreno/OpenCL driver combinations refuse to initialise, so a failed GPU
                // attempt must never leave the user without a working model.
                const loadAttempts: { gpuLayers: number; devices: string[]; gpu: boolean }[] = []
                if (gpuLayers > 0 && devices.length > 0) {
                    loadAttempts.push({ gpuLayers, devices, gpu: true })
                }
                loadAttempts.push({ gpuLayers: 0, devices: [], gpu: false })

                let llamaContext: Awaited<ReturnType<typeof tryLoad>>
                let usingGpu = false
                // Mark the GPU session as in-flight. If this process dies before the
                // flag is cleared, the next startup knows OpenCL is unsafe here.
                if (loadAttempts.some((attempt) => attempt.gpu)) {
                    mmkv.set(Global.GpuSessionDirty, true)
                }
                for (const attempt of loadAttempts) {
                    llamaContext = await tryLoad(attempt.gpuLayers, attempt.devices)
                    if (llamaContext) {
                        usingGpu = attempt.gpu
                        if (attempt.gpu) Logger.info('GPU offload active (OpenCL)')
                        else if (loadAttempts.length > 1)
                            Logger.warn('GPU offload unavailable, running on CPU')
                        break
                    }
                    if (generation !== modelLoadGeneration) break
                }
                // Nothing can reach the GPU backend once we are on CPU, so do not
                // leave a false crash record behind.
                if (!usingGpu) mmkv.set(Global.GpuSessionDirty, false)

                if (generation !== modelLoadGeneration) {
                    await llamaContext?.release().catch(() => undefined)
                    Logger.info('Discarded stale model load')
                    return
                }

                if (!llamaContext) {
                    Logger.errorToast(t('model.toast.couldNotLoadModel'))
                    return
                }

                set({
                    context: llamaContext,
                    model: model,
                    chatCount: 1,
                })

                // updated EngineData
                useLlamaPreferencesStore.getState().setLastModelLoaded(model)
                KV.useKVStore.getState().setKvCacheLoaded(false)
            })()

            activeModelLoad = task
            activeModelLoadId = model.id
            const clear = () => {
                if (activeModelLoad === task) {
                    activeModelLoad = undefined
                    activeModelLoadId = undefined
                }
            }
            void task.then(clear, clear)
            return task
        },
        loadMmproj: async (model: ModelDataType) => {
            const context = get().context
            if (!context) return

            let model_path = model.file_path
            if (model.file_path.includes('content://')) {
                model_path = (await getContentFd(model_path)) ?? model_path
            }

            Logger.info('Loading MMPROJ')
            await context.initMultimodal({ path: model_path, use_gpu: true }).catch((e) => {
                if (model.file_path.includes('content://')) {
                    closeFd(model_path)
                }

                Logger.errorToast(t('model.toast.failedToLoadMMPROJ'), e)
            })
            if (await context.isMultimodalEnabled()) {
                const capabilities = await context.getMultimodalSupport()
                Logger.info(
                    `MMPROJ Loaded:\n- Vision: ${capabilities.vision}\n- Audio: ${capabilities.audio}`
                )
            }

            set({
                mmproj: model,
            })

            useLlamaPreferencesStore.getState().setLastMmprojLoaded(model)
        },
        setLoadProgress: (progress: number) => {
            set({ loadProgress: progress })
        },
        unload: async () => {
            modelLoadGeneration++
            mmkv.set(Global.GpuSessionDirty, false)
            if (get().mmproj) {
                await get().context?.releaseMultimodal()
            }

            await get().context?.release()
            set({
                context: undefined,
                model: undefined,
                mmproj: undefined,
            })
            Logger.info('Model Unloaded')
        },
        unloadMmproj: async () => {
            if (!get().mmproj) return
            await get()
                .context?.releaseMultimodal()
                .catch((e) => {
                    Logger.errorToast(t('model.toast.failedToUnloadMMPROJ'), e)
                })
            set({
                mmproj: undefined,
            })
        },
        completion: async (
            params: CompletionParams,
            callback = (text: string) => {},
            completed = (text: string) => {}
        ) => {
            const llamaContext = get().context
            if (llamaContext === undefined) {
                Logger.errorToast(t('model.toast.noModelLoaded'))
                return
            }

            if (activeCompletion) {
                Logger.warnToast('The local model is already answering another message.')
                return
            }

            const task = llamaContext
                .completion(params, (data) => {
                    callback(data.token)
                })
                .then(async ({ text, timings }: CompletionOutput) => {
                    completed(text, timings)
                    if (mmkv.getBoolean(Global.GpuSessionDirty)) {
                        mmkv.set(Global.GpuSessionDirty, false)
                        Logger.info('GPU backend survived a full generation')
                    }
                    Logger.info(
                        `\n---- Start Chat ${get().chatCount} ----\n${textTimings(timings)}\n---- End Chat ${get().chatCount} ----\n`
                    )
                    set({ chatCount: get().chatCount + 1 })
                    if (mmkv.getBoolean(AppSettings.SaveLocalKV)) {
                        await get().saveKV(params.prompt, params.media_paths ?? [])
                    }
                })

            activeCompletion = task
            try {
                await task
            } finally {
                if (activeCompletion === task) activeCompletion = undefined
            }
        },
        stopCompletion: async () => {
            await get().context?.stopCompletion()
        },
        saveKV: async (prompt, media_paths) => {
            const llamaContext = get().context
            if (!llamaContext) {
                Logger.errorToast(t('model.toast.noModelLoaded'))
                return
            }

            if (prompt) {
                const tokens = (await get().tokenize(prompt, media_paths ?? []))?.tokens
                KV.useKVStore.getState().setKvCacheTokens(tokens ?? [])
            }

            if (!fileExists(sessionFile)) {
                Logger.warn('Session file does not exist, creating...')
                await writeBase64File(sessionFile, '')
            }

            const now = performance.now()
            const data = await llamaContext.saveSession(sessionFile.replace('file://', ''))
            Logger.info(
                data === -1
                    ? 'Failed to save KV cache'
                    : `Saved KV in ${Math.floor(performance.now() - now)}ms with ${data} tokens`
            )
            Logger.info(`Current KV Size is: ${readableFileSize(await KV.getKVSize())}`)
        },
        loadKV: async () => {
            let result = false
            const llamaContext = get().context
            if (!llamaContext) {
                Logger.errorToast(t('model.toast.noModelLoaded'))
                return false
            }
            if (!fileExists(sessionFile)) {
                Logger.warn('No Cache found')
                return false
            }
            await llamaContext
                .loadSession(sessionFile.replace('file://', ''))
                .then(() => {
                    Logger.info('Session loaded from KV cache')
                    result = true
                })
                .catch(() => {
                    Logger.error('Session loaded could not load from KV cache')
                })
            return result
        },
        tokenLength: async (text: string, mediaPaths: string[] = []) => {
            const finalPaths = get().mmproj ? mediaPaths : []
            if (!get().mmproj && mediaPaths.length > 0) {
                Logger.warnToast(t('model.toast.mediaAddedWithoutMMPROJModel'))
            }
            const result = await get().context?.tokenize(
                text + finalPaths.map(() => RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER).join(),
                {
                    media_paths: finalPaths.map((item) => item.replace('file://', '')),
                }
            )
            if (!result) return 0
            return result.tokens.length
        },
        tokenize: async (text: string, media_paths: string[] = []) => {
            const params = get().mmproj ? { media_paths } : {}
            return await get().context?.tokenize(text, params)
        },
    }))

    const textTimings = (timings: CompletionTimings) => {
        return (
            `\n[Prompt Timings]` +
            (timings.prompt_n > 0
                ? `\nPrompt Per Token: ${timings.prompt_per_token_ms.toFixed(2)} ms/token` +
                  `\nPrompt Per Second: ${timings.prompt_per_second?.toFixed(2) ?? 0} tokens/s` +
                  `\nPrompt Time: ${(timings.prompt_ms / 1000).toFixed(2)}s` +
                  `\nPrompt Tokens: ${timings.prompt_n} tokens`
                : '\nNo Tokens Processed') +
            `\n\n[Predicted Timings]` +
            (timings.predicted_n > 0
                ? `\nPredicted Per Token: ${timings.predicted_per_token_ms.toFixed(2)} ms/token` +
                  `\nPredicted Per Second: ${timings.predicted_per_second?.toFixed(2) ?? 0} tokens/s` +
                  `\nPrediction Time: ${(timings.predicted_ms / 1000).toFixed(2)}s` +
                  `\nPredicted Tokens: ${timings.predicted_n} tokens\n`
                : '\nNo Tokens Generated')
        )
    }
}
