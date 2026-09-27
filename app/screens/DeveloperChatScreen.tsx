import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import HeaderTitle from '@components/views/HeaderTitle'
import { useDeveloperContactStore } from '@lib/state/DeveloperContact'
import { Theme } from '@lib/theme/ThemeManager'

const DeveloperChatScreen = () => {
    const styles = useStyles()
    const markRead = useDeveloperContactStore((state) => state.markRead)
    const tutorialSent = useDeveloperContactStore((state) => state.tutorialSent)
    const disclaimerSent = useDeveloperContactStore((state) => state.disclaimerSent)
    const pureLoveWarningSent = useDeveloperContactStore((state) => state.pureLoveWarningSent)
    const unlockMessageSent = useDeveloperContactStore((state) => state.unlockMessageSent)

    useEffect(() => {
        markRead()
    }, [markRead])

    const messages = [
        tutorialSent ? TUTORIAL_MESSAGE : undefined,
        disclaimerSent ? DISCLAIMER_MESSAGE : undefined,
        pureLoveWarningSent ? '不行，纯爱万岁' : undefined,
        unlockMessageSent ? '你咋知道的？' : undefined,
    ].filter((message): message is string => !!message)

    return (
        <SafeAreaView edges={['bottom']} style={styles.container}>
            <HeaderTitle title="开发者" />
            <View style={styles.chatArea}>
                <View style={styles.messageList}>
                    {messages.map((message) => (
                        <View key={message} style={styles.row}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>开</Text>
                            </View>
                            <View style={styles.bubble}>
                                <Text style={styles.message}>{message}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </SafeAreaView>
    )
}

export default DeveloperChatScreen

const TUTORIAL_MESSAGE = `使用教程
1. 先在“模型”里自动扫描或下载一个 GGUF 模型。
2. 回到联系人页，点右上角新增人设或导入角色卡。
3. 普通模式最多 5 位联系人；开启开发者模式后不限人数。
4. 钱包、转账、朋友圈和联系人的生活轨迹都是虚构功能，不涉及真实资金。
5. 模型、记忆和聊天数据都保存在本机，换模型不会清空联系人记忆。

遇到问题可以直接告诉我。`

const DISCLAIMER_MESSAGE = `使用声明
明月里的联系人、钱包、转账和社交动态都属于虚构体验，不代表现实关系或真实资金。
AI 可能出错，请勿把生成内容用于医疗、法律、财务或人身安全等重大决定。
禁止利用本应用欺骗、威胁、骚扰他人，或诱导任何人自杀、自残和伤害他人。
请遵守你所在地的法律，并避免让未成年人接触不适宜内容。`

const useStyles = () => {
    const { color, spacing } = Theme.useTheme()
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: color.neutral._100,
        },
        chatArea: {
            flex: 1,
            padding: spacing.l,
        },
        messageList: {
            rowGap: spacing.m,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            columnGap: spacing.m,
        },
        avatar: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.primary._500,
        },
        avatarText: {
            color: color.text._900,
            fontSize: 20,
            fontWeight: '700',
        },
        bubble: {
            maxWidth: '75%',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.m,
            borderRadius: 18,
            backgroundColor: color.neutral._200,
            borderWidth: 1,
            borderColor: color.neutral._400,
        },
        message: {
            color: color.text._100,
            fontSize: 16,
            lineHeight: 22,
        },
    })
}
