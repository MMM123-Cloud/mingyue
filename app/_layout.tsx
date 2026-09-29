import { SplashScreen, Stack } from 'expo-router'
import { setOptions } from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { AlertProvider } from '@components/views/Alert'
import { PortalHost } from '@components/views/Portal'
import { GlassProvider, GlassPanel, isLightColor } from '@lib/ui/Glass'
import AppBootstrap from '@lib/ui/AppBootstrap'
import { Theme } from '@lib/theme/ThemeManager'
import '../i18n/i18n'

SplashScreen.preventAutoHideAsync()
setOptions({
    fade: true,
    duration: 350,
})

const Layout = () => {
    const { color } = Theme.useTheme()
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
                <GlassProvider>
                    <AlertProvider />
                    <AppBootstrap>
                        <Stack
                            screenOptions={{
                                animation: 'simple_push',
                                headerBackButtonDisplayMode: 'minimal',
                                headerStyle: { backgroundColor: 'transparent' },
                                headerBackground: () => (
                                    <GlassPanel
                                        blur
                                        style={{ flex: 1, borderRadius: 0, borderWidth: 0 }}
                                    />
                                ),
                                headerTitleStyle: { color: color.text._100 },
                                headerTintColor: color.text._100,
                                contentStyle: { backgroundColor: 'transparent' },
                                headerShadowVisible: false,
                                headerTitleAlign: 'left',
                                statusBarStyle: isLightColor(color.neutral._100) ? 'dark' : 'light',
                            }}>
                            <Stack.Screen
                                name="(tabs)"
                                options={{ animation: 'fade', headerShown: false }}
                            />
                        </Stack>
                    </AppBootstrap>
                    <PortalHost />
                </GlassProvider>
            </KeyboardProvider>
        </GestureHandlerRootView>
    )
}

export default Layout
