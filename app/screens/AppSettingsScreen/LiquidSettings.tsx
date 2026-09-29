import AntDesign, { AntDesignIconName } from '@react-native-vector-icons/ant-design/static'
import { Href, useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { BackHandler, Image, Pressable, Text, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'

import appConfig from '@appconfig'
import HeaderTitle from '@components/views/HeaderTitle'
import AppModeToggle from '@components/views/SettingsDrawer/AppModeToggle'
import { useDeveloperModeStore } from '@lib/state/DeveloperMode'
import { Theme } from '@lib/theme/ThemeManager'

import CharacterSettings from './CharacterSettings'
import ChatSettings from './ChatSettings'
import ChatWindowSettings from './ChatWindowSettings'
import DatabaseSettings from './DatabaseSettings'
import GeneratingSettings from './GeneratingSettings'
import LanguageSettings from './LanguageSettings'
import NotificationSettings from './NotificationSettings'
import ScreenSettings from './ScreenSettings'
import SecuritySettings from './SecuritySettings'
import StyleSettings from './StyleSettings'

type Section = 'connection' | 'appearance' | 'chat' | 'privacy' | 'data' | 'advanced'
const sections: { id: Section; label: string; detail: string; icon: AntDesignIconName }[] = [
    {
        id: 'connection',
        label: '模型与连接',
        detail: '本地运行、云端 API 与运行模式',
        icon: 'link',
    },
    { id: 'appearance', label: '外观与显示', detail: '主题、字号、语言与通知', icon: 'skin' },
    { id: 'chat', label: '对话偏好', detail: '聊天窗口与回复方式', icon: 'message' },
    { id: 'privacy', label: '隐私与安全', detail: '应用锁与生物识别', icon: 'lock' },
    { id: 'data', label: '数据与备份', detail: '导出、导入与数据维护', icon: 'database' },
    { id: 'advanced', label: '开发者选项', detail: '角色设置与生成参数', icon: 'tool' },
]

function SettingsRoute({ label, path }: { label: string; path: Href }) {
    const { color } = Theme.useTheme()
    const router = useRouter()
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => router.push(path)}
            style={({ pressed }) => ({
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.5 : 1,
            })}>
            <Text style={{ flex: 1, color: color.text._100, fontSize: 15 }}>{label}</Text>
            <AntDesign accessible={false} name="right" size={12} color={color.text._400} />
        </Pressable>
    )
}

export default function LiquidSettings() {
    const { color } = Theme.useTheme()
    const router = useRouter()
    const devMode = useDeveloperModeStore((state) => state.enabled)
    const [selected, setSelected] = useState<Section>()
    useFocusEffect(
        useCallback(() => {
            if (!selected) return
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                setSelected(undefined)
                return true
            })
            return () => subscription.remove()
        }, [selected])
    )
    const chosen = sections.find((section) => section.id === selected)
    return (
        <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled">
            <HeaderTitle title={chosen?.label ?? '我的'} />
            {chosen ? (
                <>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="返回我的设置"
                        onPress={() => setSelected(undefined)}
                        style={({ pressed }) => ({
                            minHeight: 48,
                            flexDirection: 'row',
                            gap: 8,
                            alignItems: 'center',
                            opacity: pressed ? 0.5 : 1,
                        })}>
                        <AntDesign
                            accessible={false}
                            name="arrow-left"
                            size={20}
                            color={color.primary._700}
                        />
                        <Text style={{ color: color.primary._700, fontSize: 14 }}>全部设置</Text>
                    </Pressable>
                    <View
                        style={{
                            gap: 24,
                            backgroundColor: color.neutral._200,
                            borderRadius: 20,
                            padding: 20,
                        }}>
                        {selected === 'connection' && (
                            <>
                                <AppModeToggle />
                                <SettingsRoute label="管理本地模型" path="/(tabs)/models" />
                                <SettingsRoute
                                    label="管理 API 连接"
                                    path="/screens/ConnectionsManagerScreen"
                                />
                            </>
                        )}
                        {selected === 'appearance' && (
                            <>
                                <StyleSettings />
                                <ScreenSettings />
                                <LanguageSettings />
                                <NotificationSettings />
                            </>
                        )}
                        {selected === 'chat' && (
                            <>
                                <ChatSettings />
                                <ChatWindowSettings />
                            </>
                        )}
                        {selected === 'privacy' && <SecuritySettings />}
                        {selected === 'data' && <DatabaseSettings />}
                        {selected === 'advanced' && devMode && (
                            <>
                                <CharacterSettings />
                                <GeneratingSettings />
                                <SettingsRoute
                                    label="采样器"
                                    path="/screens/SamplerManagerScreen"
                                />
                                <SettingsRoute
                                    label="提示词格式"
                                    path="/screens/FormattingManagerScreen"
                                />
                                <SettingsRoute
                                    label="世界书"
                                    path="/screens/LorebookManagerScreen"
                                />
                                <SettingsRoute label="语音设置" path="/screens/TTSManagerScreen" />
                                <SettingsRoute label="运行日志" path="/screens/LogsScreen" />
                            </>
                        )}
                    </View>
                </>
            ) : (
                <>
                    <View
                        style={{
                            flexDirection: 'row',
                            gap: 16,
                            alignItems: 'center',
                            paddingVertical: 8,
                        }}>
                        <Image
                            accessible={false}
                            source={require('../../../assets/images/liquid-icon.png')}
                            style={{ width: 64, height: 64, borderRadius: 20 }}
                        />
                        <View style={{ flex: 1, gap: 6 }}>
                            <Text
                                style={{ color: color.text._100, fontWeight: '600', fontSize: 20 }}>
                                我的明月
                            </Text>
                            <Text style={{ color: color.text._400, fontSize: 13, lineHeight: 20 }}>
                                按自己的习惯，慢慢调整。
                            </Text>
                        </View>
                    </View>
                    <View
                        style={{
                            backgroundColor: color.neutral._200,
                            borderRadius: 20,
                            overflow: 'hidden',
                        }}>
                        {sections
                            .filter((section) => section.id !== 'advanced' || devMode)
                            .map((section, index) => (
                                <Pressable
                                    key={section.id}
                                    accessibilityRole="button"
                                    accessibilityLabel={section.label}
                                    onPress={() => setSelected(section.id)}
                                    style={({ pressed }) => ({
                                        minHeight: 76,
                                        padding: 16,
                                        gap: 14,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        borderTopWidth: index ? 1 : 0,
                                        borderTopColor: color.neutral._300,
                                        backgroundColor: pressed
                                            ? color.primary._100
                                            : 'transparent',
                                    })}>
                                    <View
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 12,
                                            backgroundColor: color.primary._100,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                        <AntDesign
                                            accessible={false}
                                            name={section.icon}
                                            size={19}
                                            color={color.primary._700}
                                        />
                                    </View>
                                    <View style={{ flex: 1, gap: 5 }}>
                                        <Text
                                            style={{
                                                color: color.text._100,
                                                fontSize: 15,
                                                fontWeight: '500',
                                            }}>
                                            {section.label}
                                        </Text>
                                        <Text
                                            style={{
                                                color: color.text._400,
                                                fontSize: 12,
                                                lineHeight: 18,
                                            }}>
                                            {section.detail}
                                        </Text>
                                    </View>
                                    <AntDesign
                                        accessible={false}
                                        name="right"
                                        size={12}
                                        color={color.text._400}
                                    />
                                </Pressable>
                            ))}
                    </View>
                    <View
                        style={{
                            backgroundColor: color.neutral._200,
                            borderRadius: 20,
                            overflow: 'hidden',
                        }}>
                        {[
                            {
                                label: '虚拟钱包',
                                icon: 'wallet' as AntDesignIconName,
                                path: '/screens/WalletScreen',
                            },
                            {
                                label: '关于明月',
                                icon: 'info-circle' as AntDesignIconName,
                                path: '/screens/AboutScreen',
                            },
                        ].map((item, index) => (
                            <Pressable
                                key={item.label}
                                accessibilityRole="button"
                                accessibilityLabel={item.label}
                                onPress={() => router.push(item.path as Href)}
                                style={({ pressed }) => ({
                                    minHeight: 60,
                                    paddingHorizontal: 20,
                                    gap: 14,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    borderTopWidth: index ? 1 : 0,
                                    borderTopColor: color.neutral._300,
                                    backgroundColor: pressed ? color.primary._100 : 'transparent',
                                })}>
                                <AntDesign
                                    accessible={false}
                                    name={item.icon}
                                    size={19}
                                    color={color.text._300}
                                />
                                <Text style={{ flex: 1, color: color.text._200, fontSize: 15 }}>
                                    {item.label}
                                </Text>
                                <AntDesign
                                    accessible={false}
                                    name="right"
                                    size={12}
                                    color={color.text._400}
                                />
                            </Pressable>
                        ))}
                    </View>
                    <Text style={{ textAlign: 'center', color: color.text._400, fontSize: 12 }}>
                        明月 {appConfig.expo.version} · 设置自动保存在设备
                    </Text>
                </>
            )}
        </KeyboardAwareScrollView>
    )
}
