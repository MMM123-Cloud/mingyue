import AntDesign from '@react-native-vector-icons/ant-design/static'
import React, { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import ThemedButton from '@components/buttons/ThemedButton'
import { Theme } from '@lib/theme/ThemeManager'

type FirstRunNoticeProps = {
    onAccept: () => void
}

const sections = [
    {
        title: 'AI 内容可能不准确',
        body: '明月提供 AI 对话与虚构联系人体验。生成内容可能不完整、不准确或与事实不符，请自行判断。',
    },
    {
        title: '不要代替现实决策',
        body: '请勿把 AI 输出用于医疗、法律、财务或人身安全等重大决定。遇到现实危机时，请联系可信的人和当地紧急服务。',
    },
    {
        title: '禁止伤害与欺骗',
        body: '禁止利用明月进行诈骗、骚扰、威胁、侵犯隐私，或诱导、哄骗、鼓励任何人自残、自杀或伤害他人。',
    },
    {
        title: '内容与数据',
        body: 'AI 可能生成成人或敏感内容，请遵守所在地法律法规，并避免未成年人接触。聊天记录、联系人和模型数据由你自行管理并备份。',
    },
    {
        title: '免费与自愿赞助',
        body: '所有功能免费，赞助完全自愿，不会解锁功能或改变 AI 表现。',
    },
]

const FirstRunNotice: React.FC<FirstRunNoticeProps> = ({ onAccept }) => {
    const styles = useStyles()
    const [accepted, setAccepted] = useState(false)

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Image
                    source={require('../../../assets/images/liquid-icon.png')}
                    style={styles.icon}
                />
                <View style={styles.headerText}>
                    <Text style={styles.title}>使用声明</Text>
                    <Text style={styles.subtitle}>首次使用前请阅读并确认</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {sections.map((section, index) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            {index + 1}. {section.title}
                        </Text>
                        <Text style={styles.sectionBody}>{section.body}</Text>
                    </View>
                ))}
            </ScrollView>

            <Pressable
                style={styles.confirmRow}
                onPress={() => setAccepted((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: accepted }}>
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                    {accepted && <AntDesign name="check" size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.confirmText}>我已阅读并同意以上声明，确认后不再显示</Text>
            </Pressable>

            <ThemedButton
                label="确认并继续"
                variant={accepted ? 'primary' : 'disabled'}
                buttonStyle={styles.continueButton}
                onPress={() => {
                    if (accepted) onAccept()
                }}
            />
        </SafeAreaView>
    )
}

export default FirstRunNotice

const useStyles = () => {
    const { color, spacing, fontSize, borderRadius } = Theme.useTheme()

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: color.neutral._100,
            paddingHorizontal: spacing.xl2,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.xl,
            paddingTop: spacing.xl2,
            paddingBottom: spacing.xl,
        },
        icon: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#000000',
        },
        headerText: {
            flex: 1,
        },
        title: {
            color: color.text._100,
            fontSize: fontSize.xl3,
            fontWeight: '700',
        },
        subtitle: {
            color: color.text._400,
            fontSize: fontSize.m,
            marginTop: spacing.xs,
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            paddingBottom: spacing.xl,
        },
        section: {
            paddingVertical: spacing.l,
            borderBottomWidth: 1,
            borderBottomColor: color.neutral._300,
        },
        sectionTitle: {
            color: color.text._100,
            fontSize: fontSize.l,
            fontWeight: '600',
        },
        sectionBody: {
            color: color.text._300,
            fontSize: fontSize.m,
            lineHeight: 22,
            marginTop: spacing.s,
        },
        confirmRow: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.l,
            paddingVertical: spacing.xl,
        },
        checkbox: {
            width: 24,
            height: 24,
            borderRadius: borderRadius.s,
            borderWidth: 2,
            borderColor: color.neutral._600,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkboxChecked: {
            borderColor: color.primary._500,
            backgroundColor: color.primary._500,
        },
        confirmText: {
            flex: 1,
            color: color.text._200,
            fontSize: fontSize.m,
            lineHeight: 20,
        },
        continueButton: {
            marginBottom: spacing.xl,
        },
    })
}
