import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { setStringAsync } from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'

import ThemedButton from '@components/buttons/ThemedButton'
import ThemedTextInput from '@components/input/ThemedTextInput'
import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import { Logger } from '@lib/state/Logger'
import { Theme } from '@lib/theme/ThemeManager'

const DEVELOPER_QQ = '2703568134'

const SupportScreen = () => {
    const { t } = useTranslation()
    const router = useRouter()
    const styles = useStyles()
    const [contact, setContact] = useState('')

    const copyText = async (value: string, emptyHint: string, doneHint: string) => {
        const trimmed = value.trim()
        if (!trimmed) {
            Logger.warnToast(emptyHint)
            return
        }
        await setStringAsync(trimmed)
        Logger.infoToast(doneHint)
    }

    return (
        <SafeAreaView edges={['bottom']} style={styles.container}>
            <HeaderTitle title={t('supportPage.title')} />
            <HeaderButton
                headerLeft={() => (
                    <ThemedButton
                        iconName="left"
                        variant="tertiary"
                        iconSize={22}
                        onPress={() => router.back()}
                    />
                )}
            />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.freeBadge}>
                    <Text style={styles.freeText}>{t('supportPage.free')}</Text>
                </View>
                <Text style={styles.label}>{t('supportPage.label')}</Text>
                <View style={styles.contactCard}>
                    <Text style={styles.contactName}>开发者 QQ</Text>
                    <Text style={styles.contactValue}>{DEVELOPER_QQ}</Text>
                </View>
                <ThemedButton
                    label="复制开发者 QQ"
                    variant="secondary"
                    buttonStyle={styles.copyButton}
                    onPress={() => copyText(DEVELOPER_QQ, '暂无联系方式', '开发者 QQ 已复制')}
                />
                <Text style={styles.contactLabel}>{t('supportPage.leaveContact')}</Text>
                <ThemedTextInput
                    value={contact}
                    onChangeText={setContact}
                    placeholder="微信号 / QQ / 邮箱"
                    containerStyle={styles.contactInput}
                />
                <ThemedButton
                    label={t('supportPage.copyContact')}
                    variant="secondary"
                    buttonStyle={styles.copyButton}
                    onPress={() =>
                        copyText(contact, '请先填写联系方式', '联系方式已复制，可发给我')
                    }
                />
                <Text style={styles.voluntary}>{t('supportPage.voluntary')}</Text>
                <Text style={styles.thanks}>{t('supportPage.thanks')}</Text>
            </ScrollView>
        </SafeAreaView>
    )
}

export default SupportScreen

const useStyles = () => {
    const { color, spacing, fontSize, borderRadius } = Theme.useTheme()

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: color.neutral._100,
        },
        content: {
            alignItems: 'center',
            paddingHorizontal: spacing.xl2,
            paddingBottom: spacing.xl3,
        },
        freeBadge: {
            width: '100%',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.l,
            borderRadius: borderRadius.m,
            backgroundColor: color.primary._100,
            borderWidth: 1,
            borderColor: color.primary._400,
        },
        freeText: {
            color: color.primary._800,
            fontSize: fontSize.m,
            textAlign: 'center',
            lineHeight: 21,
        },
        label: {
            color: color.text._200,
            fontSize: fontSize.l,
            textAlign: 'center',
            marginTop: spacing.xl2,
            marginBottom: spacing.xl,
        },
        contactCard: {
            width: '100%',
            alignItems: 'center',
            paddingVertical: spacing.xl,
            borderRadius: borderRadius.m,
            borderWidth: 1,
            borderColor: color.neutral._400,
            backgroundColor: color.neutral._200,
        },
        contactName: {
            color: color.text._200,
            fontSize: fontSize.m,
        },
        contactValue: {
            color: color.text._100,
            fontSize: fontSize.xl,
            fontWeight: '600',
            marginTop: spacing.s,
        },
        contactLabel: {
            width: '100%',
            color: color.text._200,
            fontSize: fontSize.m,
            textAlign: 'center',
            marginTop: spacing.xl2,
        },
        contactInput: {
            width: '100%',
            marginTop: spacing.m,
        },
        copyButton: {
            width: '100%',
            marginTop: spacing.m,
        },
        voluntary: {
            color: color.text._400,
            fontSize: fontSize.m,
            lineHeight: 21,
            textAlign: 'center',
            marginTop: spacing.xl,
        },
        thanks: {
            color: color.primary._700,
            fontSize: fontSize.m,
            textAlign: 'center',
            marginTop: spacing.xl2,
        },
    })
}
