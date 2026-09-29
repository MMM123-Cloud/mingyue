import { Tabs } from 'expo-router'

import LiquidTabBar from '@lib/ui/LiquidTabBar'
import { GlassPanel } from '@lib/ui/Glass'
import { Theme } from '@lib/theme/ThemeManager'

export default function TabLayout() {
    const { color } = Theme.useTheme()
    return (
        <Tabs
            tabBar={(props) => <LiquidTabBar {...props} />}
            screenOptions={{
                headerStyle: { backgroundColor: 'transparent' },
                headerTitleStyle: { color: color.text._100, fontWeight: '600', fontSize: 20 },
                headerTintColor: color.text._100,
                headerTitleAlign: 'left',
                headerShadowVisible: false,
                headerBackground: () => (
                    <GlassPanel
                        blur
                        style={{ flex: 1, borderRadius: 0, borderWidth: 0, boxShadow: undefined }}
                    />
                ),
                sceneStyle: { backgroundColor: 'transparent' },
                animation: 'fade',
            }}>
            <Tabs.Screen name="index" options={{ title: '明月', headerShown: false }} />
            <Tabs.Screen name="moments" options={{ title: '动态' }} />
            <Tabs.Screen name="models" options={{ title: '本地模型' }} />
            <Tabs.Screen name="me" options={{ title: '我的' }} />
        </Tabs>
    )
}
