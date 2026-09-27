import { useTranslation } from 'react-i18next'
import { Linking, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'
import { useShallow } from 'zustand/react/shallow'

import { sanitizeAssistantOutput } from '@lib/constants/ContentRules'
import { AppSettings } from '@lib/constants/GlobalValues'
import { useAppMode } from '@lib/state/AppMode'
import { Chats, useInference } from '@lib/state/Chat'
import { splitNarration } from '@lib/markdown/Narration'
import { Theme } from '@lib/theme/ThemeManager'

import ChatAttachments from './ChatAttachments'
import ChatQuickActions, { useChatActionsState } from './ChatQuickActions'
import ChatSwipes from './ChatSwipes'
import ChatText from './ChatText'
import ChatTextLast from './ChatTextLast'

type ChatTextProps = {
    nowGenerating: boolean
    isLastMessage: boolean
    isGreeting: boolean
    entry: Chats.db.live.LiveEntry
}

const ChatBubble: React.FC<ChatTextProps> = ({
    nowGenerating,
    entry,
    isLastMessage,
    isGreeting,
}) => {
    const { t } = useTranslation()
    const { appMode } = useAppMode()
    const [showTPS] = useMMKVBoolean(AppSettings.ShowTokenPerSecond)
    const { color, spacing, borderRadius, fontSize } = Theme.useTheme()

    const { setShowOptions } = useChatActionsState(
        useShallow((state) => ({
            setShowOptions: state.setActiveIndex,
        }))
    )

    const { buffer } = Chats.useBuffer()
    const currentSwipeId = useInference((state) => state.currentSwipeId)

    const swipe = entry.swipes[0]
    if (!entry || !swipe) return

    const showSwipe = !entry.is_user && isLastMessage
    const timings = swipe.timings
    const transfer = parseTransfer(swipe.swipe)
    const location = parseLocation(swipe.swipe)
    const isStreaming = nowGenerating && swipe.id === currentSwipeId
    const messageText = isStreaming
        ? sanitizeAssistantOutput(buffer.data)
        : swipe.swipe
    const { narration, dialogue } = splitNarration(messageText)
    const showNarration =
        !transfer && !location && narration.length > 0 && dialogue.length > 0
    const bubbleColor = transfer
        ? '#A65F22'
        : location
          ? color.neutral._300
          : entry.is_user
            ? color.primary._400
            : color.neutral._200
    const bubbleBorderColor = transfer
        ? '#E3A153'
        : location
          ? color.neutral._500
          : entry.is_user
            ? color.primary._500
            : color.neutral._400
    return (
        <View>
            <View
                style={{
                    alignSelf: entry.is_user ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                }}>
                {showNarration && (
                    <Text
                        style={{
                            color: color.text._400,
                            fontStyle: 'italic',
                            fontSize: fontSize.m,
                            lineHeight: 21,
                            paddingHorizontal: 4,
                            paddingBottom: 4,
                        }}>
                        {narration}
                    </Text>
                )}
                <Pressable
                onPress={() => {
                    setShowOptions(nowGenerating ? undefined : entry.id)
                }}
                style={{
                    backgroundColor: bubbleColor,
                    borderColor: bubbleBorderColor,
                    borderWidth: 1,
                    marginBottom: showSwipe ? 0 : 6,
                    paddingVertical: location ? 6 : spacing.m,
                    paddingHorizontal: spacing.l,
                    minHeight: 40,
                    borderRadius: 14,
                    borderLeftWidth: entry.is_user ? 1 : 3,
                    borderRightWidth: entry.is_user ? 3 : 1,
                    shadowColor: color.shadow,
                    boxShadow: [
                        {
                            offsetX: 0,
                            offsetY: 3,
                            spreadDistance: 0,
                            color: color.shadow,
                            blurRadius: 12,
                        },
                    ],
                }}>
                {transfer ? (
                    <TransferMessage transfer={transfer} />
                ) : location ? (
                    <LocationMessage location={location} />
                ) : isLastMessage ? (
                    <ChatTextLast
                        nowGenerating={nowGenerating}
                        swipe={swipe}
                        isUser={entry.is_user}
                        variant="dialogue"
                    />
                ) : (
                    <ChatText
                        isUser={entry.is_user}
                        swipeText={swipe.swipe}
                        variant="dialogue"
                    />
                )}
                <ChatAttachments entry={entry} />
                <View
                    style={{
                        flexDirection: 'row',
                    }}>
                    {showTPS && appMode === 'local' && timings && (
                        <Text
                            style={{
                                color: color.text._500,
                                fontWeight: '300',
                                textAlign: 'right',
                                fontSize: fontSize.s,
                            }}>
                            {t('chat.bubble.promptSpeed', {
                                tokens: getFiniteValue(timings.prompt_per_second),
                                seconds: getFiniteValue(timings.prompt_ms / 1000),
                            })}
                            {t('chat.bubble.textGenerationSpeed', {
                                tokens: getFiniteValue(timings.predicted_per_second),
                                seconds: getFiniteValue(timings.predicted_ms / 1000),
                            })}
                        </Text>
                    )}

                    <ChatQuickActions
                        nowGenerating={nowGenerating}
                        isLastMessage={isLastMessage}
                        entryId={entry.id}
                        isUser={entry.is_user}
                        swipe={swipe}
                    />
                </View>
                </Pressable>
            </View>
            {showSwipe && (
                <ChatSwipes swipe={swipe} nowGenerating={nowGenerating} isGreeting={isGreeting} />
            )}
        </View>
    )
}

const getFiniteValue = (value: number | null) => {
    if (!value || !isFinite(value)) return (0).toFixed(2)
    return value.toFixed(2)
}

type TransferInfo = {
    amount: string
    note: string
}

const parseTransfer = (text: string): TransferInfo | undefined => {
    const match = text.match(
        /^\[转账\]\s*¥?\s*([0-9]+(?:\.[0-9]{1,2})?)(?:\s*\|\s*备注[：:]\s*(.*))?/
    )
    if (!match) return undefined
    return { amount: match[1], note: match[2] || '无备注' }
}

const TransferMessage: React.FC<{ transfer: TransferInfo }> = ({ transfer }) => {
    return (
        <View style={{ minWidth: 210, rowGap: 4 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13 }}>转账</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '700' }}>
                ¥{transfer.amount}
            </Text>
            <Text style={{ color: '#FFFFFFDD', fontSize: 12 }}>备注：{transfer.note}</Text>
        </View>
    )
}

type LocationInfo = {
    name: string
    latitude: number
    longitude: number
    intro?: string
}

const parseLocation = (text: string): LocationInfo | undefined => {
    const match = text.match(
        /\[位置\]\s*([^|\n]+?)\s*\|\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)/
    )
    if (!match) return undefined

    const latitude = Number(match[2])
    const longitude = Number(match[3])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined

    const markerIndex = text.indexOf(match[0])
    const intro = text.slice(0, markerIndex).trim()

    return {
        name: match[1].trim(),
        latitude,
        longitude,
        intro: intro || undefined,
    }
}

const LocationMessage: React.FC<{ location: LocationInfo }> = ({ location }) => {
    const { color } = Theme.useTheme()
    const openMap = () => {
        const name = encodeURIComponent(location.name)
        const url = `https://uri.amap.com/marker?position=${location.longitude},${location.latitude}&name=${name}`
        Linking.openURL(url).catch(() => undefined)
    }

    return (
        <TouchableOpacity
            activeOpacity={0.86}
            onPress={openMap}
            style={{ minWidth: 220, maxWidth: 270, rowGap: 8 }}>
            {location.intro && (
                <Text style={{ color: color.text._100, fontSize: 15, lineHeight: 21 }}>
                    {location.intro}
                </Text>
            )}
            <View
                style={{
                    height: 88,
                    borderRadius: 5,
                    backgroundColor: color.neutral._400,
                    padding: 12,
                    justifyContent: 'space-between',
                }}>
                <Text
                    style={{ color: color.text._100, fontSize: 15, fontWeight: '600' }}
                    numberOfLines={1}>
                    {location.name}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: color.text._400, fontSize: 11 }}>
                        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </Text>
                    <Text style={{ color: color.primary._700, fontSize: 11 }}>查看地图</Text>
                </View>
            </View>
        </TouchableOpacity>
    )
}

export default ChatBubble
