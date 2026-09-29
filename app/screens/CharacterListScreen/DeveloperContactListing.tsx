import { useRouter } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useDeveloperContactStore } from '@lib/state/DeveloperContact'
import { Theme } from '@lib/theme/ThemeManager'
import { getFriendlyTimeStamp } from '@lib/utils/Time'

const DeveloperContactListing = () => {
    const router = useRouter()
    const status = useDeveloperContactStore((state) => state.status)
    const acceptedAt = useDeveloperContactStore((state) => state.acceptedAt)
    const read = useDeveloperContactStore((state) => state.read)
    const tutorialSent = useDeveloperContactStore((state) => state.tutorialSent)
    const disclaimerSent = useDeveloperContactStore((state) => state.disclaimerSent)
    const pureLoveWarningSent = useDeveloperContactStore((state) => state.pureLoveWarningSent)
    const lastWarningAt = useDeveloperContactStore((state) => state.lastWarningAt)
    const unlockMessageSent = useDeveloperContactStore((state) => state.unlockMessageSent)
    const unlockMessageAt = useDeveloperContactStore((state) => state.unlockMessageAt)
    const styles = useStyles()

    if (
        status !== 'accepted' ||
        (!tutorialSent && !disclaimerSent && !pureLoveWarningSent && !unlockMessageSent)
    )
        return null

    const lastMessageAt = unlockMessageAt ?? lastWarningAt ?? acceptedAt

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push('/screens/DeveloperChatScreen')}
            style={styles.container}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>开</Text>
                {!read && <View style={styles.unread} />}
            </View>
            <View style={styles.content}>
                <View style={styles.topLine}>
                    <Text style={styles.name}>开发者</Text>
                    <Text style={styles.time}>
                        {lastMessageAt ? getFriendlyTimeStamp(lastMessageAt) : ''}
                    </Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                    {unlockMessageSent
                        ? '你咋知道的？'
                        : pureLoveWarningSent
                          ? '不行，纯爱万岁'
                          : '使用教程和声明'}
                </Text>
            </View>
        </TouchableOpacity>
    )
}

export default DeveloperContactListing

const useStyles = () => {
    const { color, spacing } = Theme.useTheme()
    return StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.m,
            paddingHorizontal: spacing.l,
            backgroundColor: color.neutral._200,
            borderWidth: 1,
            borderColor: color.primary._400,
            borderRadius: 12,
        },
        avatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.primary._500,
        },
        avatarText: {
            color: color.text._900,
            fontSize: 22,
            fontWeight: '700',
        },
        unread: {
            position: 'absolute',
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#FA5151',
            borderWidth: 2,
            borderColor: color.neutral._200,
        },
        content: {
            flex: 1,
            paddingLeft: 12,
        },
        topLine: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        name: {
            color: color.text._100,
            fontSize: 16,
            fontWeight: '500',
        },
        time: {
            color: color.text._400,
            fontSize: 12,
        },
        preview: {
            color: color.text._500,
            fontSize: 14,
            marginTop: 4,
        },
    })
}
