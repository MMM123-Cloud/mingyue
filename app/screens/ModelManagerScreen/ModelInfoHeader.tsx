import AntDesign from '@react-native-vector-icons/ant-design/static'
import { totalMemory } from 'expo-device'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import * as Progress from 'react-native-progress'
import { useShallow } from 'zustand/react/shallow'

import { GlassPanel } from '@lib/ui/Glass'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { Theme } from '@lib/theme/ThemeManager'

type ModelInfoHeaderProps = {
    modelImporting: boolean
    modelLoading: boolean
    modelListLength: number
    modelUpdatedAt: Date | undefined
}

export default function ModelInfoHeader({
    modelImporting,
    modelLoading,
    modelListLength,
}: ModelInfoHeaderProps) {
    const { color } = Theme.useTheme()
    const styles = useStyles()
    const { name, ready, loading, progress } = Llama.useLlamaModelStore(
        useShallow((state) => ({
            name: state.model?.name,
            ready: !!state.context,
            loading: state.loading,
            progress: state.loadProgress,
        }))
    )
    const working = modelImporting || modelLoading || loading
    return (
        <GlassPanel style={styles.modelContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <AntDesign name="cloud-download" size={22} color={color.primary._700} />
                <Text style={{ color: color.text._100, fontSize: 20, fontWeight: '600', flex: 1 }}>
                    在这台设备上运行
                </Text>
            </View>
            <Text style={{ color: color.text._300, fontSize: 14, lineHeight: 23 }}>
                导入 GGUF 模型后，断网也能对话。先从 0.6B 的 Q4 模型开始。
            </Text>
            <Text style={{ color: color.text._400, fontSize: 12, lineHeight: 20, marginTop: 6 }}>
                {totalMemory ? `设备内存 ${(totalMemory / 1024 ** 3).toFixed(1)} GB · ` : ''}
                大模型需要更多内存与等待时间。
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
                {working ? (
                    <ActivityIndicator size="small" color={color.primary._600} />
                ) : (
                    <View
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: 4,
                            backgroundColor: ready ? color.primary._600 : color.neutral._500,
                        }}
                    />
                )}
                <Text style={{ color: color.text._200, fontSize: 13, flex: 1 }}>
                    {modelImporting
                        ? '正在导入模型…'
                        : modelLoading || loading
                          ? `正在加载 · ${Math.round(progress)}%`
                          : ready
                            ? name
                            : modelListLength
                              ? '选择一个模型，点击加载'
                              : '点击右上角，导入第一个模型'}
                </Text>
            </View>
            {working && (
                <Progress.Bar
                    indeterminate={modelImporting}
                    progress={progress / 100}
                    width={null}
                    height={3}
                    borderWidth={0}
                    color={color.primary._600}
                    unfilledColor={color.neutral._300}
                    style={{ marginTop: 14 }}
                />
            )}
        </GlassPanel>
    )
}

export const useStyles = () => {
    const { color } = Theme.useTheme()
    return StyleSheet.create({
        mainContainer: { paddingHorizontal: 20, paddingTop: 16, flex: 1 },
        list: { flex: 1 },
        modelContainer: { borderRadius: 24, padding: 20, marginBottom: 24 },
        title: { fontSize: 17, color: color.text._100 },
        modelTitle: { color: color.primary._700, flex: 1 },
        subtitle: { color: color.text._300 },
        hint: { color: color.text._400 },
    })
}
