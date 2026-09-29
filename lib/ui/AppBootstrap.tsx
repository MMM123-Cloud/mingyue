import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { SplashScreen, usePathname } from 'expo-router'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'

import ThemedButton from '@components/buttons/ThemedButton'
import FirstRunNotice from '@components/views/FirstRunNotice'
import { db } from '@db/db'
import { AppSettings } from '@lib/constants/GlobalValues'
import useLocalAuth from '@lib/hooks/LocalAuth'
import { Theme } from '@lib/theme/ThemeManager'
import { loadChatOnInit, startupApp, useTextIntentFocus } from '@lib/utils/Startup'
import { useAppStateNotificationObserver } from '@lib/notifications/Notifications'

import migrations from '../../db/migrations/migrations'

const useStartupRoutine = () => {
    const { success, error: migrationError } = useMigrations(db, migrations)
    const { authorized, retry } = useLocalAuth()
    const [ready, setReady] = useState(false)
    const [startupError, setStartupError] = useState<Error>()
    useEffect(() => {
        if (!authorized || !success) return
        let cancelled = false
        void startupApp()
            .then(() => {
                if (cancelled) return
                setReady(true)
            })
            .catch((error) => {
                if (!cancelled)
                    setStartupError(error instanceof Error ? error : new Error(String(error)))
            })
            .finally(() => {
                void SplashScreen.hideAsync()
            })
        return () => {
            cancelled = true
        }
    }, [authorized, success])
    useEffect(() => {
        if (migrationError) void SplashScreen.hideAsync()
    }, [migrationError])
    return { authorized, retry, error: migrationError ?? startupError, success: ready }
}

const MainHome = ({ children }: PropsWithChildren) => {
    const { color } = Theme.useTheme()
    const styles = useStyles()
    const { authorized, retry, error, success } = useStartupRoutine()
    const { t } = useTranslation()
    if (error)
        return (
            <View style={styles.centeredContainer}>
                <Text style={styles.title}>{t('db.migrationerror.title')}</Text>
                <Text style={styles.errorLog}>{error.message}</Text>
                <Text style={styles.subtitle}>{t('db.migrationerror.description')}</Text>
                <Text style={styles.subtitle} />
                <ThemedButton
                    variant="secondary"
                    label={t('about.license')}
                    iconName="file"
                    iconSize={20}
                    onPress={() => {
                        Linking.openURL('https://www.gnu.org/licenses/agpl-3.0.html')
                    }}
                />
            </View>
        )

    if (!authorized)
        return (
            <View style={[styles.centeredContainer, { rowGap: 60 }]}>
                <AntDesign
                    name="lock"
                    size={120}
                    style={{ marginBottom: 12 }}
                    color={color.text._500}
                />
                <Text style={styles.title}>{t('auth.authorizationRequired')}</Text>
                <TouchableOpacity onPress={retry} style={styles.button}>
                    <Text style={styles.buttonText}>{t('common.actions.tryAgain')}</Text>
                </TouchableOpacity>
            </View>
        )
    if (success) return <ReadyRuntime>{children}</ReadyRuntime>
    return (
        <View style={styles.centeredContainer}>
            <ActivityIndicator color={color.primary._700} />
            <Text style={styles.subtitle}>正在准备明月…</Text>
        </View>
    )
}

const AppBootstrap = ({ children }: PropsWithChildren) => {
    const [noticeAccepted, setNoticeAccepted] = useMMKVBoolean(AppSettings.InstallNoticeAccepted)

    useEffect(() => {
        void SplashScreen.hideAsync()
    }, [])

    if (!noticeAccepted) {
        return <FirstRunNotice onAccept={() => setNoticeAccepted(true)} />
    }

    return <MainHome>{children}</MainHome>
}

const ReadyRuntime = ({ children }: PropsWithChildren) => {
    useTextIntentFocus()
    useAppStateNotificationObserver()
    const path = usePathname()
    const initialPath = useRef(path)
    useEffect(() => {
        // Navigation runs after the root stack mounts; deep links keep their destination.
        if (initialPath.current === '/') void loadChatOnInit()
    }, [])
    return <>{children}</>
}

export default AppBootstrap

const useStyles = () => {
    const { color, spacing, fontSize, borderWidth } = Theme.useTheme()
    return StyleSheet.create({
        centeredContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },

        title: {
            color: color.text._300,
            fontSize: fontSize.xl2,
        },

        subtitle: {
            color: color.text._400,
            marginHorizontal: 24,
            textAlign: 'center',
        },

        errorLog: {
            color: color.text._400,
            fontSize: fontSize.s,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.l,
            borderRadius: 12,
            margin: spacing.xl2,
            backgroundColor: color.neutral._200,
        },

        buttonText: {
            color: color.text._100,
        },

        button: {
            paddingVertical: spacing.l,
            paddingHorizontal: spacing.xl2,
            columnGap: spacing.m,
            borderRadius: spacing.xl2,
            borderWidth: borderWidth.m,
            borderColor: color.primary._500,
        },
    })
}
