import { Linking, View } from 'react-native'
import { useMMKVString } from 'react-native-mmkv'

import Alert from '@components/views/Alert'
import ContextMenu from '@components/views/ContextMenu'
import { Model } from '@lib/engine/Local/Model'
import { Storage } from '@lib/enums/Storage'
import { Logger } from '@lib/state/Logger'

const SAFE_MODELS = [
    {
        label: '8B 高配 · 储存约 4.68 GB · 建议 8-12 GB RAM',
        url: 'https://hf-mirror.com/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf',
    },
    {
        label: '4B 中配 · 储存约 2.33 GB · 建议 6 GB RAM',
        url: 'https://hf-mirror.com/ggml-org/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
    },
    {
        label: '1.7B 低配 · 储存约 1.19 GB · 建议 3-4 GB RAM',
        url: 'https://hf-mirror.com/ggml-org/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
    },
    {
        label: '0.6B 推荐入门 · 储存约 0.37 GB · 建议 2 GB RAM',
        url: 'https://hf-mirror.com/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf',
    },
    {
        label: '14B 顶配 · 储存约 8.38 GB · 建议 16 GB RAM 以上',
        url: 'https://hf-mirror.com/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf',
    },
] as const

const LOCAL_MODELS = [
    {
        label: '8B 高配 · 储存约 4.68 GB · 建议 8-12 GB RAM',
        url: 'https://hf-mirror.com/bartowski/mlabonne_Qwen3-8B-abliterated-GGUF/resolve/main/mlabonne_Qwen3-8B-abliterated-Q4_K_M.gguf',
    },
    {
        label: '4B 中配 · 储存约 2.32 GB · 建议 6 GB RAM',
        url: 'https://hf-mirror.com/bartowski/mlabonne_Qwen3-4B-abliterated-GGUF/resolve/main/mlabonne_Qwen3-4B-abliterated-Q4_K_M.gguf',
    },
    {
        label: '1.7B 低配 · 储存约 1.03 GB · 建议 3-4 GB RAM',
        url: 'https://hf-mirror.com/bartowski/mlabonne_Qwen3-1.7B-abliterated-GGUF/resolve/main/mlabonne_Qwen3-1.7B-abliterated-Q4_K_M.gguf',
    },
    {
        label: '0.6B 推荐入门 · 储存约 0.37 GB · 建议 2 GB RAM',
        url: 'https://hf-mirror.com/bartowski/mlabonne_Qwen3-0.6B-abliterated-GGUF/resolve/main/mlabonne_Qwen3-0.6B-abliterated-Q4_K_M.gguf',
    },
    {
        label: '14B 顶配 · 储存约 8.38 GB · 建议 16 GB RAM 以上',
        url: 'https://hf-mirror.com/bartowski/mlabonne_Qwen3-14B-abliterated-GGUF/resolve/main/mlabonne_Qwen3-14B-abliterated-Q4_K_M.gguf',
    },
] as const

type ModelNewMenuProps = {
    modelImporting: boolean
    setModelImporting: (b: boolean) => void
}

const ModelNewMenu: React.FC<ModelNewMenuProps> = ({ modelImporting, setModelImporting }) => {
    const [scanDirectory] = useMMKVString(Storage.ModelScanDirectory)

    const handleScanModels = async (close: () => void, forcePickDirectory: boolean = false) => {
        close()
        if (modelImporting) return
        setModelImporting(true)
        try {
            const result = await Model.scanExternalModels(forcePickDirectory)
            if (!result) return
            if (result.found === 0) {
                Logger.infoToast('没有找到 .gguf 模型，请选择模型所在的文件夹')
                return
            }
            Logger.infoToast(
                `扫描完成：发现 ${result.found} 个，新增 ${result.added} 个，跳过 ${result.skipped} 个`
            )
        } catch (error) {
            Logger.errorToast('扫描模型失败，请重新选择模型文件夹')
            Logger.error(error)
        } finally {
            setModelImporting(false)
        }
    }

    const handleOpenSafeModel = async (close: () => void, url: string) => {
        close()
        try {
            await Linking.openURL(url)
        } catch (error) {
            Logger.errorToast('无法打开模型下载链接')
            Logger.error(error)
        }
    }
    const handleOpenLocalModel = (close: () => void, url: string) => {
        close()
        Alert.alert({
            title: '下载本地包',
            description:
                '本地包包含成人内容规则，仅限成年人本人使用。请确认你已满 18 岁，并且下载和使用在你所在地合法。继续下载代表你自行承担责任。',
            buttons: [
                { label: '取消' },
                {
                    label: '确认下载',
                    type: 'warning',
                    onPress: async () => {
                        try {
                            await Linking.openURL(url)
                        } catch (error) {
                            Logger.errorToast('无法打开模型下载链接')
                            Logger.error(error)
                        }
                    },
                },
            ],
        })
    }
    const handleImportModel = async (close: () => void) => {
        close()
        if (modelImporting) return
        setModelImporting(true)
        try {
            await Model.importModel()
        } catch (error) {
            Logger.errorToast('模型导入失败，请检查剩余空间和文件权限。', error)
        } finally {
            setModelImporting(false)
        }
    }

    return (
        <View>
            <ContextMenu
                accessibilityLabel="导入或下载模型"
                placement="bottom"
                triggerIcon="file-add"
                disabled={modelImporting}
                buttons={[
                    {
                        label: '自动扫描手机模型',
                        icon: 'scan',
                        border: true,
                        onPress: (close: () => void) => handleScanModels(close),
                    },
                    ...(scanDirectory
                        ? [
                              {
                                  label: '更换扫描文件夹',
                                  icon: 'folder' as const,
                                  onPress: (close: () => void) => handleScanModels(close, true),
                              },
                          ]
                        : []),
                    {
                        label: '手动选择 GGUF 模型',
                        icon: 'file-add',
                        onPress: handleImportModel,
                    },
                    {
                        label: '下载安全模型',
                        icon: 'cloud-download',
                        submenu: [...SAFE_MODELS]
                            .sort((a, b) => parseFloat(a.label) - parseFloat(b.label))
                            .map((model) => ({
                                label: model.label,
                                icon: 'cloud-download' as const,
                                onPress: (close: () => void) =>
                                    handleOpenSafeModel(close, model.url),
                            })),
                    },
                    {
                        label: '下载本地包',
                        icon: 'download',
                        submenu: LOCAL_MODELS.map((model) => ({
                            label: model.label,
                            icon: 'download' as const,
                            onPress: (close: () => void) => handleOpenLocalModel(close, model.url),
                        })),
                    },
                ]}
            />
        </View>
    )
}

export default ModelNewMenu
