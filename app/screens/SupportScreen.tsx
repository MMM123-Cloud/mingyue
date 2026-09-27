import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'

import { setStringAsync } from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'

import ThemedButton from '@components/buttons/ThemedButton'
import ThemedTextInput from '@components/input/ThemedTextInput'
import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import { Logger } from '@lib/state/Logger'
import { Theme } from '@lib/theme/ThemeManager'

const SupportScreen = () => {
    const { t } = useTranslation()
    const router = useRouter()
    const styles = useStyles()
    const [contact, setContact] = useState('')

    const handleCopyContact = async () => {
        const value = contact.trim()
        if (!value) {
            Logger.warnToast('请先填写联系方式')
            return
        }
        await setStringAsync(value)
        Logger.infoToast('联系方式已复制，可粘贴到转账备注')
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
                <View style={styles.qrFrame}>
                    <Image
                        source={require('../../assets/images/support-code.png')}
                        style={styles.qr}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.qrHint}>{t('supportPage.qrHint')}</Text>
                <Text style={styles.contactLabel}>请留下联系方式，以便于我更新时联系您</Text>
                <ThemedTextInput
                    value={contact}
                    onChangeText={setContact}
                    placeholder="微信号 / QQ / 邮箱"
                    containerStyle={styles.contactInput}
                />
                <ThemedButton
                    label="复制联系方式"
                    variant="secondary"
                    buttonStyle={styles.copyButton}
                    onPress={handleCopyContact}
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
        qrFrame: {
            width: 264,
            height: 264,
            padding: spacing.m,
            borderRadius: borderRadius.l,
            backgroundColor: '#FFFFFF',
        },
        qr: {
            width: '100%',
            height: '100%',
        },
        qrHint: {
            color: color.text._100,
            fontSize: fontSize.xl,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: spacing.xl,
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
