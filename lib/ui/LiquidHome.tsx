import AntDesign from '@react-native-vector-icons/ant-design/static'
import { Href, useRouter } from 'expo-router'
import { Image, Pressable, Text, View } from 'react-native'

import { GlassPanel } from '@lib/ui/Glass'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { useAppMode } from '@lib/state/AppMode'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'

export function MoonHomeHeader() {
    const { color } = Theme.useTheme()
    const { appMode } = useAppMode()
    const router = useRouter()
    const model = Llama.useLlamaModelStore((state) => state.model)
    const ready = Llama.useLlamaModelStore((state) => Boolean(state.context))
    const loading = Llama.useLlamaModelStore((state) => state.loading)
    const lastModel = Llama.useLlamaPreferencesStore((state) => state.lastModel)
    const canChat = appMode === 'remote' || ready || Boolean(lastModel)
    return (
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 24 }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                <View style={{ flex: 1, gap: 4 }}>
                    <Text
                        accessibilityRole="header"
                        style={{
                            color: color.text._100,
                            fontSize: 30,
                            fontWeight: '600',
                            letterSpacing: 1,
                        }}>
                        明月
                    </Text>
                    <Text style={{ color: color.text._400, fontSize: 13 }}>让对话，轻一点。</Text>
                </View>
                <GlassPanel blur style={{ borderRadius: 24 }}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="打开我的设置"
                        onPress={() => router.navigate('/(tabs)/me')}
                        style={({ pressed }) => ({
                            width: 48,
                            height: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.55 : 1,
                        })}>
                        <AntDesign
                            accessible={false}
                            name="setting"
                            size={21}
                            color={color.text._300}
                        />
                    </Pressable>
                </GlassPanel>
            </View>
            <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <View style={{ flex: 1, gap: 10 }}>
                    <Text
                        style={{
                            color: color.text._100,
                            fontSize: 21,
                            fontWeight: '500',
                            lineHeight: 30,
                        }}>
                        今天，想聊点什么？
                    </Text>
                    <Text style={{ color: color.text._400, fontSize: 14, lineHeight: 22 }}>
                        一点日常，一个灵感。{'\n'}从这里开始。
                    </Text>
                </View>
                <Image
                    accessible={false}
                    source={require('../../assets/images/liquid-icon-foreground.png')}
                    resizeMode="contain"
                    style={{ width: 112, height: 112 }}
                />
            </View>
            <GlassPanel blur style={{ borderRadius: 28 }}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={canChat ? '开始对话' : '导入本地模型'}
                    onPress={() =>
                        router.push(
                            (canChat ? '/screens/DirectChatScreen' : '/(tabs)/models') as Href
                        )
                    }
                    style={({ pressed }) => ({
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        minHeight: 56,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: withAlpha(color.primary._200, pressed ? 'D8' : '80'),
                    })}>
                    <AntDesign
                        accessible={false}
                        name="message"
                        size={22}
                        color={color.primary._700}
                    />
                    <Text
                        style={{
                            flex: 1,
                            color: color.primary._700,
                            fontWeight: '600',
                            fontSize: 16,
                        }}>
                        {canChat ? '开始对话' : '导入本地模型'}
                    </Text>
                    <AntDesign
                        accessible={false}
                        name="arrow-right"
                        size={20}
                        color={color.primary._700}
                    />
                </Pressable>
            </GlassPanel>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={appMode === 'local' ? '查看本地模型' : '查看 API 连接'}
                onPress={() =>
                    router.navigate(
                        (appMode === 'local'
                            ? '/(tabs)/models'
                            : '/screens/ConnectionsManagerScreen') as Href
                    )
                }
                style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    minHeight: 48,
                    opacity: pressed ? 0.55 : 1,
                })}>
                <View
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: ready ? color.primary._600 : color.neutral._500,
                    }}
                />
                <Text
                    numberOfLines={2}
                    style={{ flex: 1, color: color.text._400, fontSize: 12, lineHeight: 18 }}>
                    {appMode === 'remote'
                        ? '云端连接 · API 模式'
                        : loading
                          ? '正在准备本地模型…'
                          : ready && model
                            ? `本地运行 · ${model.name}`
                            : lastModel
                              ? `待加载 · ${lastModel.name}`
                              : '离线使用，从添加一个小模型开始'}
                </Text>
                <AntDesign accessible={false} name="right" size={12} color={color.text._400} />
            </Pressable>
        </View>
    )
}
