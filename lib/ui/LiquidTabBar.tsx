import AntDesign, { AntDesignIconName } from '@react-native-vector-icons/ant-design/static'
import { Tabs } from 'expo-router'
import { ComponentProps } from 'react'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'

import { Theme } from '@lib/theme/ThemeManager'
import { withAlpha } from '@lib/theme/ThemeColor'

import { GlassPanel } from './Glass'

const labels: Record<string, { label: string; icon: AntDesignIconName }> = {
    index: { label: '对话', icon: 'message' },
    moments: { label: '动态', icon: 'picture' },
    models: { label: '模型', icon: 'appstore' },
    me: { label: '我的', icon: 'user' },
}

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

export default function LiquidTabBar({ state, navigation, insets }: TabBarProps) {
    const { color } = Theme.useTheme()
    const { width } = useWindowDimensions()
    return (
        <View
            style={{
                paddingHorizontal: width > 700 ? 72 : 20,
                paddingTop: 8,
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: 'transparent',
            }}>
            <GlassPanel
                blur
                style={{ borderRadius: 32, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 4, padding: 6 }}>
                    {state.routes.map((route, index) => {
                        const item = labels[route.name]
                        if (!item) return null
                        const selected = state.index === index
                        return (
                            <Pressable
                                key={route.key}
                                accessibilityRole="tab"
                                accessibilityLabel={item.label}
                                accessibilityState={{ selected }}
                                onPress={() => {
                                    const event = navigation.emit({
                                        type: 'tabPress',
                                        target: route.key,
                                        canPreventDefault: true,
                                    })
                                    if (!selected && !event.defaultPrevented)
                                        navigation.navigate(route.name)
                                }}
                                onLongPress={() =>
                                    navigation.emit({ type: 'tabLongPress', target: route.key })
                                }
                                style={({ pressed }) => ({
                                    flex: 1,
                                    minHeight: 52,
                                    paddingVertical: 6,
                                    borderRadius: 26,
                                    gap: 4,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: selected
                                        ? withAlpha(color.primary._200, 'B0')
                                        : pressed
                                          ? withAlpha(color.neutral._300, '80')
                                          : 'transparent',
                                })}>
                                <AntDesign
                                    accessible={false}
                                    name={item.icon}
                                    size={21}
                                    color={selected ? color.primary._700 : color.text._400}
                                />
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: selected ? '600' : '400',
                                        color: selected ? color.primary._700 : color.text._400,
                                    }}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        )
                    })}
                </View>
            </GlassPanel>
        </View>
    )
}
