import { closeFd, copyFileSAF, getContentFd } from '@vali98/react-native-fs'
import { loadLlamaModelInfo } from 'cui-llama.rn'
import { eq, inArray, notInArray } from 'drizzle-orm'
import { getDocumentAsync } from 'expo-document-picker'
import { Directory } from 'expo-file-system'
import { t } from 'i18next'
import { Platform } from 'react-native'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { db } from '@db/db'
import { model_data, model_mmproj_links, ModelDataType } from '@db/schema'
import { Storage } from '@lib/enums/Storage'
import { CharacterLink } from '@lib/state/CharacterLinks'
import { Logger } from '@lib/state/Logger'
import { createMMKVStorage, mmkv } from '@lib/storage/MMKV'
import {
    AppDirectory,
    copyFile,
    deleteFile,
    fileExists,
    fileInfo,
    listFiles,
    readableFileSize,
    readFileMagic,
} from '@lib/utils/File'

import { GGMLNameMap, GGMLType } from './GGML'
import { matchedTokenPrefix } from './RuntimeConfig'

export type ModelData = Omit<ModelDataType, 'id' | 'create_date' | 'last_modified'>
export type ModelListQueryType = Omit<
    Awaited<ReturnType<typeof Model.getModelListQuery2>>[0],
    'mmprojLink'
> & {
    mmprojLink?: {
        model_id: number
        mmproj_id: number
    }
}
export type ModelScanResult = {
    found: number
    added: number
    skipped: number
    failed: number
}

const GGUF_EXTENSION = '.gguf'
const MAX_SCAN_DEPTH = 10
const MAX_SCAN_DIRECTORIES = 6000
const MAX_SCAN_MODELS = 500
const mmprojArchs = ['clip', 'llava']

export namespace Model {
    export const getModelList = async () => {
        return listFiles(AppDirectory.ModelPath)
    }

    export const deleteModelById = async (id: number) => {
        const modelInfo = await db.query.model_data.findFirst({ where: eq(model_data.id, id) })
        if (!modelInfo) return
        // some models may be external
        if (modelInfo.file_path.startsWith(AppDirectory.ModelPath))
            await deleteModelFile(modelInfo.file)
        await db.delete(model_data).where(eq(model_data.id, id))
        await CharacterLink.db.mutate.deleteByValue('model_id', id)
    }

    export const isMMPROJ = (arch: string) => {
        return mmprojArchs.includes(arch)
    }

    export const importModel = async () => {
        return getDocumentAsync({
            copyToCacheDirectory: false,
        }).then(async (result) => {
            if (result.canceled) return
            const file = result.assets[0]
            if (!file.name.toLowerCase().endsWith(GGUF_EXTENSION)) {
                Logger.warnToast('请选择 GGUF 模型文件。')
                return
            }
            const existing = await getModelList()
            const name = getUniqueModelFilename(
                file.name,
                new Set(existing.map((n) => n.toLowerCase()))
            )
            const newdir = `${AppDirectory.ModelPath}${name}`
            Logger.infoToast(t('common.messages.importingFile'))
            let success = false

            if (file.uri.startsWith('content://') && Platform.OS === 'android') {
                await copyFileSAF(file.uri, newdir.replace('file://', ''))
                    .then(() => {
                        success = true
                    })
                    .catch((e) => {
                        Logger.warnToast(t('common.errors.failedToCopy'))
                        Logger.warn(e)
                        success = false
                    })
            } else {
                success = await copyFile({
                    from: file.uri,
                    to: newdir,
                })
            }

            if (!success) return

            // database routine here
            if (await createModelData(name, true))
                Logger.infoToast(t('model.toast.modelImportedSuccessfully'))
        })
    }

    const collectExternalModels = (rootUri: string) => {
        const visited = new Set<string>()
        const queue: { uri: string; depth: number }[] = [{ uri: rootUri, depth: 0 }]
        const files: { name: string; uri: string }[] = []

        while (queue.length > 0 && visited.size < MAX_SCAN_DIRECTORIES) {
            const current = queue.shift()
            if (!current || visited.has(current.uri) || current.depth > MAX_SCAN_DEPTH) continue
            visited.add(current.uri)

            let entries
            try {
                entries = new Directory(current.uri).list()
            } catch (error) {
                Logger.warn(`Unable to scan directory: ${current.uri}`)
                continue
            }

            for (const entry of entries) {
                if (entry instanceof Directory) {
                    if (current.depth < MAX_SCAN_DEPTH) {
                        queue.push({ uri: entry.uri, depth: current.depth + 1 })
                    }
                    continue
                }

                if (entry.name.toLowerCase().endsWith(GGUF_EXTENSION)) {
                    files.push({ name: entry.name, uri: entry.uri })
                    if (files.length >= MAX_SCAN_MODELS) return files
                }
            }
        }

        return files
    }

    const getUniqueModelFilename = (filename: string, usedNames: Set<string>) => {
        const fallback = filename.trim() || `model-${Date.now()}${GGUF_EXTENSION}`
        if (!usedNames.has(fallback.toLowerCase())) return fallback

        const stem = fallback.toLowerCase().endsWith(GGUF_EXTENSION)
            ? fallback.slice(0, -GGUF_EXTENSION.length)
            : fallback
        for (let index = 2; index < 10000; index++) {
            const candidate = `${stem} (${index})${GGUF_EXTENSION}`
            if (!usedNames.has(candidate.toLowerCase())) return candidate
        }
        return `model-${Date.now()}${GGUF_EXTENSION}`
    }

    const scanExternalDirectory = async (rootUri: string): Promise<ModelScanResult> => {
        const foundFiles = collectExternalModels(rootUri).sort((a, b) =>
            a.name.localeCompare(b.name)
        )
        const existingModels = await db.query.model_data.findMany({
            columns: { file: true, file_path: true },
        })
        const existingPaths = new Set(existingModels.map((item) => item.file_path))
        const usedNames = new Set(existingModels.map((item) => item.file.toLowerCase()))
        const result: ModelScanResult = {
            found: foundFiles.length,
            added: 0,
            skipped: 0,
            failed: 0,
        }

        for (const file of foundFiles) {
            if (existingPaths.has(file.uri)) {
                result.skipped++
                continue
            }

            const filename = getUniqueModelFilename(file.name, usedNames)
            const success = await createExternalModelData(filename, file.uri, false)
            if (!success) {
                result.failed++
                continue
            }

            result.added++
            existingPaths.add(file.uri)
            usedNames.add(filename.toLowerCase())
        }

        return result
    }

    export const scanExternalModels = async (
        forcePickDirectory: boolean = false
    ): Promise<ModelScanResult | undefined> => {
        const savedDirectory = forcePickDirectory
            ? undefined
            : mmkv.getString(Storage.ModelScanDirectory)

        if (savedDirectory) {
            try {
                if (new Directory(savedDirectory).exists) {
                    return await scanExternalDirectory(savedDirectory)
                }
            } catch (error) {
                Logger.warn(`Saved model scan directory is unavailable: ${error}`)
            }
            mmkv.remove(Storage.ModelScanDirectory)
        }

        let directory: Directory
        try {
            directory = await Directory.pickDirectoryAsync()
        } catch {
            return undefined
        }

        mmkv.set(Storage.ModelScanDirectory, directory.uri)
        return await scanExternalDirectory(directory.uri)
    }

    export const createExternalModelData = async (
        filename: string,
        filePath: string,
        deleteOnFailure: boolean = false
    ) => {
        return setModelDataInternal(filename, filePath, deleteOnFailure)
    }

    export const getModelExists = (path: string) => {
        return fileExists(path)
    }

    export const verifyModelList = async () => {
        let modelList = await db.query.model_data.findMany()
        const fileList = await getModelList()

        // cull missing models
        if (Platform.OS === 'android') {
            for (const item of modelList) {
                if (item.name === '' || !getModelExists(item.file_path)) {
                    Logger.warnToast(t('model.toast.modelMissingEntryDeleted', { name: item.name }))
                    await db.delete(model_data).where(eq(model_data.id, item.id))
                }
            }
        }

        // refresh as some may have been deleted
        modelList = await db.query.model_data.findMany()

        // create data as migration step
        for (const item of fileList) {
            if (modelList.some((model_data) => model_data.file === item) || !item) continue
            Logger.info(`Creating Model Data for: ${item}`)
            await createModelData(item)
        }
    }

    export const createModelData = async (filename: string, deleteOnFailure: boolean = false) => {
        return setModelDataInternal(
            filename,
            `${AppDirectory.ModelPath}${filename}`,
            deleteOnFailure
        )
    }

    export const getModelListQuery = () => {
        return db.query.model_data.findMany()
    }

    export const getModelListQuery2 = () => {
        return db.query.model_data.findMany({
            where: notInArray(model_data.architecture, mmprojArchs),
            with: {
                mmprojLink: true,
            },
        })
    }

    export const getMMPROJListQuery = () => {
        return db.query.model_data.findMany({
            where: inArray(model_data.architecture, mmprojArchs),
            with: {
                mmprojLink: true,
            },
        })
    }

    export const getMMPROJLinks = () => {
        return db.query.model_mmproj_links.findMany()
    }

    export const createMMPROJLink = async (
        model: ModelListQueryType,
        mmproj: ModelListQueryType
    ) => {
        await db.insert(model_mmproj_links).values({ model_id: model.id, mmproj_id: mmproj.id })
    }

    export const removeMMPROJLink = async (model: ModelListQueryType) => {
        await db.delete(model_mmproj_links).where(eq(model_mmproj_links.model_id, model.id))
    }

    export const updateName = async (name: string, id: number) => {
        await db.update(model_data).set({ name: name }).where(eq(model_data.id, id))
    }

    export const isInitialEntry = (data: ModelListQueryType) => {
        const initial: ModelData = {
            file: '',
            file_path: '',
            context_length: 0,
            name: 'N/A',
            file_size: 0,
            params: 'N/A',
            quantization: '-1',
            architecture: 'N/A',
        }

        for (const key in initial) {
            if (key === 'file' || key === 'file_path') continue
            const initialV = initial[key as keyof ModelData]
            const dataV = data[key as keyof ModelListQueryType]
            if (initialV !== dataV) return false
        }
        return true
    }

    const initialModelEntry = (filename: string, file_path: string) => ({
        context_length: 0,
        file: filename,
        file_path: file_path,
        name: 'N/A',
        file_size: 0,
        params: 'N/A',
        quantization: '-1',
        architecture: 'N/A',
    })

    const setModelDataInternal = async (
        filename: string,
        file_path: string,
        deleteOnFailure: boolean
    ) => {
        let insertedId: number | undefined
        let openedFd: string | undefined
        try {
            const [{ id }] = await db
                .insert(model_data)
                .values(initialModelEntry(filename, file_path))
                .returning({ id: model_data.id })
            insertedId = id

            // This will load GGUF KV-pairs
            // refer to https://github.com/ggml-org/ggml/blob/master/docs/gguf.md#standardized-key-value-pairs
            let loadable_path = file_path

            const magicInfo = readFileMagic(loadable_path)

            Logger.info(t('model.magic', magicInfo))

            if (loadable_path.includes('content://')) {
                openedFd = await getContentFd(loadable_path)
                loadable_path = openedFd ?? loadable_path
            }

            const modelInfo: any = await loadLlamaModelInfo(loadable_path)
            let fileSize = 0
            const fileResult = fileInfo(file_path)
            if (fileResult.exists) {
                fileSize = fileResult.size ?? 0
            }
            const modelType = modelInfo?.['general.architecture']
            const modelDataEntry = {
                context_length: modelInfo?.[modelType + '.context_length'] ?? 0,
                file: filename,
                file_path: file_path,
                name: modelInfo?.['general.name'] ?? 'N/A',
                file_size: fileSize,
                params: modelInfo?.['general.size_label'] ?? filename ?? 'N/A',
                quantization: modelInfo?.['general.file_type'] ?? '-1',
                architecture: modelType ?? 'N/A',
            }
            Logger.info(`New Model Data:\n${modelDataText(modelDataEntry)}`)
            await db.update(model_data).set(modelDataEntry).where(eq(model_data.id, id))
            return true
        } catch (e) {
            if (insertedId !== undefined) {
                await db
                    .delete(model_data)
                    .where(eq(model_data.id, insertedId))
                    .catch((deleteError) =>
                        Logger.warn(`Failed to remove invalid model entry: ${deleteError}`)
                    )
            }
            Logger.errorToast(t('common.errors.failedToCreateData'), e)
            if (deleteOnFailure) deleteFile(file_path)
            return false
        } finally {
            if (openedFd) {
                await closeFd(openedFd).catch((error) =>
                    Logger.warn(`Failed to close model file descriptor: ${error}`)
                )
            }
        }
    }

    const modelDataText = (data: ModelData) => {
        const quantValue = parseInt(data.quantization) as GGMLType
        const quantType = GGMLNameMap[quantValue]
        return `Context length: ${data.context_length ?? 'N/A'}\nFile: ${data.file}\nName: ${data.name ?? 'N/A'}\nSize: ${(data.file_size && readableFileSize(data.file_size)) ?? 'N/A'}\nParams: ${data.params ?? 'N/A'}\nQuantization: ${quantType ?? 'N/A'}\nArchitecture: ${data.architecture ?? 'N/A'}`
    }

    const modelExists = async (modelName: string) => {
        return (await getModelList()).includes(modelName)
    }

    const deleteModelFile = async (name: string) => {
        if (!(await modelExists(name))) return
        return deleteFile(`${AppDirectory.ModelPath}${name}`)
    }
}

type KvVerifyResult = {
    match: boolean
    matchLength: number
    inputLength: number
    cachedLength: number
}

type KVStateProps = {
    kvCacheLoaded: boolean
    kvCacheTokens: number[]
    setKvCacheLoaded: (b: boolean) => void
    setKvCacheTokens: (na: number[]) => void
    verifyKVCache: (na: number[]) => KvVerifyResult
}

export namespace KV {
    export const useKVStore = create<KVStateProps>()(
        persist(
            (set, get) => ({
                kvCacheLoaded: false,
                kvCacheTokens: [],
                setKvCacheLoaded: (b: boolean) => {
                    set({ kvCacheLoaded: b })
                },
                setKvCacheTokens: (tokens: number[]) => {
                    set({ kvCacheTokens: tokens })
                },
                verifyKVCache: (tokens: number[]) => {
                    const cachedTokens = get().kvCacheTokens
                    const matched = matchedTokenPrefix(cachedTokens, tokens)
                    return {
                        match: matched === Math.min(cachedTokens.length, tokens.length),
                        cachedLength: cachedTokens.length,
                        inputLength: tokens.length,
                        matchLength: matched,
                    }
                },
            }),
            {
                name: Storage.KV,
                partialize: (state) => ({
                    kvCacheTokens: state.kvCacheTokens,
                }),
                storage: createMMKVStorage(),
                version: 1,
            }
        )
    )

    export const sessionFile = `${AppDirectory.SessionPath}llama-session.bin`

    export const getKVSize = async () => {
        const data = fileInfo(sessionFile)
        return data.size ?? 0
    }

    export const deleteKV = async () => {
        deleteFile(sessionFile)
    }

    export const kvInfo = async () => {
        const data = fileInfo(sessionFile)
        if (!data.exists) {
            Logger.warn('No KV Cache found')
            return
        }
        Logger.info(`Size of KV cache: ${Math.floor((data.size ?? 0) * 0.000001)} MB`)
    }
}
