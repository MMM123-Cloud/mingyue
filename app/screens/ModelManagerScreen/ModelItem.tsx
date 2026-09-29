import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import DropdownSheet from '@components/input/DropdownSheet'
import Alert from '@components/views/Alert'
import { useBottomSheetRef } from '@components/views/BottomSheet'
import ContextMenu from '@components/views/ContextMenu'
import InputSheet from '@components/views/InputSheet'
import { ModelDataType } from '@db/schema'
import { GGMLNameMap } from '@lib/engine/Local'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { Model, ModelListQueryType } from '@lib/engine/Local/Model'
import { identifyModel } from '@lib/engine/Local/ModelIdentity'
import { Logger } from '@lib/state/Logger'
import { Theme } from '@lib/theme/ThemeManager'
import { readableFileSize } from '@lib/utils/File'

type ModelItemProps = {
    item: ModelListQueryType
    modelLoading: boolean
    setModelLoading: (b: boolean) => void
    mmprojList: ModelDataType[]
    modelImporting: boolean
}

const ModelItem: React.FC<ModelItemProps> = ({
    item,
    modelImporting,
    modelLoading,
    setModelLoading,
    mmprojList,
}) => {
    const { t } = useTranslation()
    const styles = useStyles()
    const { color } = Theme.useTheme()
    const [showMMPROJSelector, setShowMMPROJSelector] = useState(false)
    const [showInfo, setShowInfo] = useState(false)
    const { loadModel, unloadModel, loadMmproj, modelId, mmprojId, loading, generating } =
        Llama.useLlamaModelStore(
            useShallow((state) => ({
                loadMmproj: state.loadMmproj,
                loadModel: state.load,
                unloadModel: state.unload,
                modelId: state.model?.id,
                mmprojId: state.mmproj?.id,
                loading: state.loading,
                generating: state.generating,
            }))
        )

    const maybeClearLastLoaded = Llama.useLlamaPreferencesStore(
        useShallow((state) => state.maybeClearLastLoaded)
    )

    const editInputRef = useBottomSheetRef()
    //@ts-ignore
    const quant: string = item.quantization && GGMLNameMap[item.quantization]
    const isInvalid = Model.isInitialEntry(item)
    const handleDeleteModel = () => {
        Alert.alert({
            title: t('model.alert.deletemodel.title'),
            description:
                t('model.alert.deletemodel.description', { name: item.name }) +
                (!isInvalid
                    ? !item.file_path.startsWith('content')
                        ? t('model.alert.deletemodel.internal', {
                              size: readableFileSize(item.file_size),
                          })
                        : t('model.alert.deletemodel.external')
                    : ''),
            buttons: [
                { label: t('common.actions.cancel') },
                {
                    label: t('model.alert.deletemodel.title'),
                    onPress: async () => {
                        if (modelId === item.id) {
                            await unloadModel()
                        }
                        await Model.deleteModelById(item.id)
                        maybeClearLastLoaded(item)
                    },
                    type: 'warning',
                },
            ],
        })
    }

    const handleUnlinkMMPROJ = async () => {
        if (item.mmprojLink) {
            await Model.removeMMPROJLink(item)
            const mmproj = mmprojList.filter((a) => a.id === item.mmprojLink?.mmproj_id)?.[0]
            if (mmproj) {
                maybeClearLastLoaded(mmproj)
            }
            return
        }
        setShowMMPROJSelector(!showMMPROJSelector)
    }

    const isMMPROJ = Model.isMMPROJ(item.architecture)
    const isLoaded = isMMPROJ ? mmprojId === item.id : modelId === item.id

    const unavailable = modelLoading || modelImporting || loading || generating
    const disable = unavailable || isInvalid || (isMMPROJ ? !modelId || isLoaded : false)
    const disableEdit = isLoaded || unavailable || isInvalid
    const disableDelete = isLoaded || unavailable

    const loadToggle = isLoaded ? unavailable : disable

    const mmprojName =
        mmprojList.filter((e) => e.id === item.mmprojLink?.mmproj_id)?.[0]?.name ?? undefined
    const identity = identifyModel({
        name: item.name,
        file: item.file,
        params: item.params,
        architecture: item.architecture,
        mmprojName,
    })
    const tags = [...identity.tags, quant, item.architecture].filter(Boolean)
    const location = item.file_path.startsWith('content')
        ? t('common.labels.external')
        : t('common.labels.internal')

    return (
        <View style={styles.modelContainer}>
            <InputSheet
                ref={editInputRef}
                onConfirm={async (name) => {
                    await Model.updateName(name, item.id)
                }}
                title={t('model.item.rename')}
                defaultValue={item.name}
            />
            <View style={{ flex: 1, alignContent: 'center' }}>
                <TouchableOpacity onPress={() => setShowInfo(!showInfo)}>
                    <Text style={styles.title}>{item.name}</Text>
                </TouchableOpacity>
                {showInfo && !isInvalid && (
                    <>
                        <View style={styles.tagContainer}>
                            {tags.map((tag, i) => {
                                return (
                                    <Text key={i} style={styles.tag} numberOfLines={1}>
                                        {tag}
                                    </Text>
                                )
                            })}
                        </View>

                        {isInvalid && (
                            <View style={styles.tagContainer}>
                                <Text style={styles.tag}>{t('model.item.invalid')}</Text>
                            </View>
                        )}

                        {!isMMPROJ && (
                            <Text style={styles.subtitle}>
                                {t('model.item.contextlength')}: {item.context_length}
                            </Text>
                        )}

                        <Text style={styles.subtitle}>
                            {t('model.item.file')}: {item.file.replace('.gguf', '')} (
                            {readableFileSize(item.file_size)}, {location})
                        </Text>
                    </>
                )}

                {mmprojName && (
                    <Text style={styles.subtitle}>
                        {t('model.mmproj')}: {mmprojName}
                    </Text>
                )}
            </View>

            <View style={styles.buttonContainer}>
                <ContextMenu
                    accessibilityLabel={`模型操作 ${item.name}`}
                    disabled={disableEdit}
                    triggerIcon="edit"
                    triggerStyle={{ color: disableEdit ? color.text._700 : color.text._400 }}
                    triggerIconSize={22}
                    buttons={[
                        {
                            label: t('model.linkmmproj'),
                            component: () => (
                                <DropdownSheet
                                    modalTitle={t('model.selectmmproj')}
                                    style={{
                                        backgroundColor: color.neutral._200,
                                        paddingVertical: 10,
                                    }}
                                    containerStyle={{ marginTop: 8 }}
                                    placeholder={t('model.linkmmproj')}
                                    data={mmprojList}
                                    selected={
                                        mmprojList.filter(
                                            (e) => e.id === item.mmprojLink?.mmproj_id
                                        )?.[0] ?? undefined
                                    }
                                    labelExtractor={(item) => item.name}
                                    onChangeValue={async (value) => {
                                        try {
                                            if (item.mmprojLink) await Model.removeMMPROJLink(item)
                                            await Model.createMMPROJLink(item, value)
                                        } catch (e) {
                                            Logger.errorToast(t('model.toast.failedtolink'), e)
                                        }
                                    }}
                                    icon={'link'}
                                    iconPosition="left"
                                    iconSize={16}
                                />
                            ),
                            disabled: isMMPROJ || !!item.mmprojLink || mmprojList.length === 0,
                        },
                        {
                            label: t('model.unlinkmmproj'),
                            onPress: (close) => {
                                handleUnlinkMMPROJ()
                                close()
                            },
                            disabled: isMMPROJ || !item.mmprojLink,
                            icon: 'disconnect',
                        },
                        {
                            label: t('common.actions.rename'),
                            onPress: (close) => {
                                editInputRef.current?.open()
                                close()
                            },
                            disabled: disableEdit,
                            icon: 'edit',
                        },

                        {
                            label: t('common.actions.delete'),
                            onPress: (close) => {
                                handleDeleteModel()
                                close()
                            },
                            disabled: disableDelete,
                            variant: 'warning',
                            icon: 'delete',
                        },
                    ]}
                />

                {!isMMPROJ && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`${isLoaded ? '卸载' : '加载'}模型 ${item.name}`}
                        accessibilityState={{ disabled: loadToggle }}
                        style={{
                            minHeight: 48,
                            minWidth: 64,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                        }}
                        disabled={loadToggle}
                        onPress={async () => {
                            setModelLoading(true)
                            try {
                                if (isLoaded) {
                                    await unloadModel()
                                    return
                                }
                                await loadModel(item)
                                if (
                                    item.mmprojLink &&
                                    Llama.useLlamaModelStore.getState().model?.id === item.id
                                ) {
                                    const mmprojModel = mmprojList.find(
                                        (a) => a.id === item.mmprojLink?.mmproj_id
                                    )
                                    if (mmprojModel) await loadMmproj(mmprojModel)
                                }
                            } catch (error) {
                                Logger.errorToast(t('model.toast.failedtoload'), error)
                            } finally {
                                setModelLoading(false)
                            }
                        }}>
                        <AntDesign
                            name={isLoaded ? 'close-circle' : 'play-circle'}
                            size={24}
                            color={
                                loadToggle
                                    ? color.text._600
                                    : isLoaded
                                      ? color.error._400
                                      : color.primary._500
                            }
                        />
                        <Text
                            style={{
                                fontSize: 12,
                                color: loadToggle ? color.text._600 : color.primary._700,
                            }}>
                            {isLoaded ? '卸载' : '加载'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    )
}

export default ModelItem

const useStyles = () => {
    const { color, spacing, borderRadius, fontSize } = Theme.useTheme()

    return StyleSheet.create({
        modelContainer: {
            borderRadius: spacing.l,
            paddingVertical: spacing.l,
            paddingHorizontal: spacing.l,
            backgroundColor: color.neutral._200,
            minHeight: 64,
            columnGap: 12,
            alignItems: 'center',
            marginBottom: spacing.l,
            flexDirection: 'row',
            justifyContent: 'space-between',
        },

        tagContainer: {
            columnGap: 2,
            rowGap: 2,
            paddingTop: spacing.m,
            paddingBottom: spacing.m,
            flexDirection: 'row',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
        },

        tag: {
            borderRadius: borderRadius.m,
            borderColor: color.primary._300,
            borderWidth: 1,
            paddingHorizontal: spacing.m,
            paddingVertical: spacing.s,
            color: color.text._300,
            textTransform: 'capitalize',
        },
        title: {
            fontSize: fontSize.l,
            color: color.text._100,
        },

        subtitle: {
            color: color.text._400,
        },

        buttonContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 2,
        },
    })
}
