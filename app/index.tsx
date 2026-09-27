import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { SplashScreen } from 'expo-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'

import ThemedButton from '@components/buttons/ThemedButton'
import FirstRunNotice from '@components/views/FirstRunNotice'
import HeaderTitle from '@components/views/HeaderTitle'
import { db } from '@db/db'
import { AppSettings } from '@lib/constants/GlobalValues'
import useLocalAuth from '@lib/hooks/LocalAuth'
import { Theme } from '@lib/theme/ThemeManager'
import { loadChatOnInit, startupApp, useTextIntentFocus } from '@lib/utils/Startup'
import CharacterList from '@screens/CharacterListScreen'

import migrations from '../db/migrations/migrations'

const useStartupRoutine = () => {
    const { success, error } = useMigrations(db, migrations)
    const { authorized, retry } = useLocalAuth()

    useTextIntentFocus()

    useEffect(() => {
        if (authorized && success) {
            loadChatOnInit()
        }
    }, [authorized, success])

    useEffect(() => {
        /**
         * Startup Routine:
         * - wait for useMigration success
         * - startupApp() - creates defaults
         */
        if (success) {
            startupApp()
            SplashScreen.hideAsync()
        }
        if (error) SplashScreen.hideAsync()
    }, [success, error])

    return { authorized, retry, error, success }
}

const MainHome = () => {
    const { color } = Theme.useTheme()
    const styles = useStyles()
    const { authorized, retry, error, success } = useStartupRoutine()
    const { t } = useTranslation()
    if (error)
        return (
            <View style={styles.centeredContainer}>
                <HeaderTitle />
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
                <HeaderTitle />
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
    if (success) return <CharacterList />
    return <HeaderTitle />
}

const Home = () => {
    const [noticeAccepted, setNoticeAccepted] = useMMKVBoolean(AppSettings.InstallNoticeAccepted)

    useEffect(() => {
        void SplashScreen.hideAsync()
    }, [])

    if (!noticeAccepted) {
        return <FirstRunNotice onAccept={() => setNoticeAccepted(true)} />
    }

    return <MainHome />
}

export default Home

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
            backgroundColor: 'black',
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
