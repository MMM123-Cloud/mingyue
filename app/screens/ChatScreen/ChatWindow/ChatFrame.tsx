import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'

import Avatar from '@components/views/Avatar'
import { AppSettings } from '@lib/constants/GlobalValues'
import { Characters } from '@lib/state/Characters'
import { Chats } from '@lib/state/Chat'
import { useAvatarViewerStore } from '@lib/state/components/AvatarViewer'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'

type ChatFrameProps = {
    children?: ReactNode
    index: number
    entry: Chats.db.live.LiveEntry
    nowGenerating: boolean
    isLast?: boolean
}

const ChatFrame: React.FC<ChatFrameProps> = ({ children, index, nowGenerating, isLast, entry }) => {
    const { t } = useTranslation()
    const { color, spacing, borderRadius, fontSize } = Theme.useTheme()
    const [wide] = useMMKVBoolean(AppSettings.WideChatMode)

    const setShowViewer = useAvatarViewerStore((state) => state.setShow)
    const charImageId = Characters.useCharacterStore((state) => state.card?.image_id) ?? 0
    const userImageId = Characters.useUserStore((state) => state.card?.image_id) ?? 0
    const swipe = entry.swipes[0]
    if (!swipe) return

    if (entry.recalled_at) {
        return (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xs }}>
                <Text style={{ color: color.text._500, fontSize: fontSize.s }}>
                    {entry.recalled_by === 'user'
                        ? t('chat.bubble.recalledByUser')
                        : t('chat.bubble.recalledByContact', { name: entry.name })}
                </Text>
            </View>
        )
    }

    const getDeltaTime = () =>
        Math.round(
            Math.max(
                0,
                // eslint-disable-next-line react-hooks/purity
                ((nowGenerating && isLast ? Date.now() : swipe.gen_finished.getTime()) -
                    swipe.gen_started.getTime()) /
                    1000
            )
        )
    const deltaTime = getDeltaTime()

    const rowDir = entry.is_user ? 'row-reverse' : 'row'
    const align = entry.is_user ? 'flex-end' : 'flex-start'
    if (wide)
        return (
            <View
                style={{
                    flex: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: withAlpha(color.neutral._100, 'bb'),
                }}>
                <View
                    style={{
                        flexDirection: rowDir,
                        alignItems: 'center',
                        marginBottom: spacing.l,
                    }}>
                    <TouchableOpacity onPress={() => setShowViewer(true, entry.is_user)}>
                        <Avatar
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: borderRadius.xl,
                                marginRight: entry.is_user ? 0 : spacing.l,
                                marginLeft: entry.is_user ? spacing.l : 0,
                            }}
                            targetImage={Characters.getImageDir(
                                entry.is_user ? userImageId : charImageId
                            )}
                        />
                    </TouchableOpacity>
                    <View style={{ alignItems: align }}>
                        <Text
                            style={{
                                fontSize: fontSize.l,
                                color: color.text._100,
                            }}>
                            {entry.name}
                        </Text>
                        <View style={{ columnGap: 12, flexDirection: rowDir }}>
                            <Text style={{ fontSize: fontSize.s, color: color.text._400 }}>
                                {swipe.gen_finished.toLocaleTimeString()}
                            </Text>
                            <Text style={{ color: color.text._700, fontSize: fontSize.s }}>
                                {t('chat.frame.entryNumber', { index })}
                            </Text>
                            {deltaTime !== undefined && !entry.is_user && index !== 0 && (
                                <Text style={{ color: color.text._700, fontSize: fontSize.s }}>
                                    {t('chat.frame.seconds', { seconds: deltaTime })}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
                {children}
            </View>
        )

    return (
        <View
            style={{
                flexDirection: entry.is_user ? 'row-reverse' : 'row',
                marginHorizontal: 12,
                columnGap: 10,
                alignItems: 'flex-start',
            }}>
            <TouchableOpacity onPress={() => setShowViewer(true, entry.is_user)}>
                <Avatar
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                    }}
                    targetImage={Characters.getImageDir(entry.is_user ? userImageId : charImageId)}
                />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: align }}>{children}</View>
        </View>
    )
}

export default ChatFrame
