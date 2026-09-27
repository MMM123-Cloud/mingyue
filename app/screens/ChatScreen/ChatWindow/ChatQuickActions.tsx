import { setStringAsync } from 'expo-clipboard'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'
import Animated, { StretchInY, StretchOutY, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import ThemedButton from '@components/buttons/ThemedButton'
import Alert from '@components/views/Alert'
import { ChatSwipe } from '@db/schema'
import { AppSettings } from '@lib/constants/GlobalValues'
import { useBackAction } from '@lib/hooks/BackAction'
import { AuthorNotes } from '@lib/state/AuthorNotes'
import { Chats, useInference } from '@lib/state/Chat'
import { authorNoteEditorState } from '@lib/state/components/AuthorNotes'
import { Logger } from '@lib/state/Logger'
import { useTTSStore } from '@lib/state/TTS'
import { Theme } from '@lib/theme/ThemeManager'

import { useAuthorNoteState } from '../AuthorNote'
import ChatTTS from './ChatTTS'

interface OptionsStateProps {
    activeEntryId?: number
    setActiveIndex: (n: number | undefined) => void
}

useInference.subscribe(({ nowGenerating }) => {
    if (nowGenerating) {
        useChatActionsState.getState().setActiveIndex(undefined)
    }
})
export const useChatActionsState = create<OptionsStateProps>()((set, get) => ({
    setActiveIndex: (n) => set({ activeEntryId: get().activeEntryId === n ? undefined : n }),
}))

interface ChatActionProps {
    entryId: number
    isUser: boolean
    nowGenerating: boolean
    isLastMessage: boolean
    swipe: ChatSwipe
}

const ChatQuickActions: React.FC<ChatActionProps> = ({
    entryId,
    isUser,
    nowGenerating,
    isLastMessage,
    swipe,
}) => {
    const { activeEntryId, setShowOptions } = useChatActionsState(
        useShallow((state) => ({
            setShowOptions: state.setActiveIndex,
            activeEntryId: state.activeEntryId,
        }))
    )

    const showNoteEditor = authorNoteEditorState(useShallow((state) => state.open))
    const ref = useAuthorNoteState(useShallow((state) => state.ref))
    const { t } = useTranslation()
    const { color } = Theme.useTheme()
    const [quickDelete] = useMMKVBoolean(AppSettings.QuickDelete)
    const { chatId } = Chats.useChat()

    const { activeSwipeId } = useTTSStore()
    const showOptions = activeEntryId === entryId

    const handleCreateAuthorNote = () => {
        if (!chatId) return
        Alert.alert({
            title: t('chat.quickActions.createNote.title'),
            description: t('chat.quickActions.createNote.description'),
            buttons: [
                { label: t('common.actions.cancel') },
                {
                    label: t('chat.quickActions.createNote.button'),
                    onPress: async () => {
                        const newNoteId = await AuthorNotes.db.mutate.createNote({
                            chat_id: chatId,
                            content: swipe.swipe,
                            depth: 1,
                        })
                        if (!newNoteId) {
                            Logger.errorToast(t('chat.quickActions.errors.noteCreateFailed'))
                            return
                        }
                        ref?.current?.open()
                        showNoteEditor(newNoteId)
                    },
                },
            ],
        })
    }

    const handleRecall = () => {
        Alert.alert({
            title: t('chat.quickActions.dialogs.recall.title'),
            description: t('chat.quickActions.dialogs.recall.description'),
            buttons: [
                { label: t('common.actions.cancel') },
                {
                    label: t('chat.quickActions.dialogs.recall.confirm'),
                    type: 'warning',
                    onPress: async () => {
                        setShowOptions(undefined)
                        const recalled = await Chats.db.mutate.recallChatEntry(
                            entryId,
                            isUser ? 'user' : 'contact'
                        )
                        if (!recalled) {
                            Logger.infoToast(
                                t('chat.quickActions.errors.recallExpired', {
                                    defaultValue: '超过 1 分钟，不能撤回',
                                })
                            )
                        }
                    },
                },
            ],
        })
    }

    const backAction = useCallback(() => {
        if (!showOptions || !swipe) return false
        setShowOptions(undefined)
        return true
    }, [showOptions, setShowOptions, swipe])

    useBackAction(backAction)

    if (!swipe) return

    const isSpeaking = swipe.id === activeSwipeId
    if (!isSpeaking && (!showOptions || nowGenerating)) return

    return (
        <View
            style={{
                flex: 1,
                alignItems: 'flex-end',
                position: 'absolute',
                bottom: -2,
                right: -4,
                width: '100%',
            }}>
            <Animated.View
                entering={StretchInY.duration(100)}
                exiting={StretchOutY.duration(100)}
                style={{
                    flexDirection: 'row',
                    columnGap: 16,
                    alignItems: 'center',
                    paddingVertical: 4,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: color.primary._500,
                    backgroundColor: color.neutral._100 + 'cc',
                    boxShadow: [
                        {
                            offsetX: 1,
                            offsetY: 1,
                            color: color.shadow,
                            spreadDistance: 1,
                            blurRadius: 4,
                        },
                    ],
                }}>
                {!(isLastMessage && nowGenerating) && (
                    <>
                        {quickDelete && (
                            <Animated.View
                                style={{ flexDirection: 'row' }}
                                entering={ZoomIn.duration(200)}
                                exiting={ZoomOut.duration(200)}>
                                <ThemedButton
                                    variant="tertiary"
                                    iconName="delete"
                                    iconSize={24}
                                    iconStyle={{
                                        color: color.error._400,
                                    }}
                                    onPress={() => {
                                        if (showOptions) setShowOptions(undefined)
                                        Chats.db.mutate.deleteChatEntry(entryId)
                                    }}
                                />
                                <View
                                    style={{
                                        borderColor: color.primary._500,
                                        borderLeftWidth: 1,
                                        marginLeft: 12,
                                        marginRight: 4,
                                    }}
                                />
                            </Animated.View>
                        )}
                        <Animated.View
                            entering={ZoomIn.duration(200)}
                            exiting={ZoomOut.duration(200)}>
                            <ThemedButton
                                variant="tertiary"
                                iconName="font-colors"
                                iconSize={22}
                                iconStyle={{
                                    color: color.text._500,
                                }}
                                onPress={handleCreateAuthorNote}
                            />
                        </Animated.View>
                        <Animated.View
                            entering={ZoomIn.duration(200)}
                            exiting={ZoomOut.duration(200)}>
                            <ThemedButton
                                variant="tertiary"
                                iconName="copy"
                                iconSize={22}
                                iconStyle={{
                                    color: color.text._500,
                                }}
                                onPress={() => {
                                    if (showOptions) setShowOptions(undefined)
                                    setStringAsync(swipe.swipe)
                                        .then(() => {
                                            Logger.infoToast(t('chat.quickActions.messages.copied'))
                                        })
                                        .catch(() => {
                                            Logger.errorToast(
                                                t('chat.quickActions.errors.copyFailed')
                                            )
                                        })
                                }}
                            />
                        </Animated.View>

                        {isUser && (
                            <Animated.View
                                entering={ZoomIn.duration(200)}
                                exiting={ZoomOut.duration(200)}>
                                <ThemedButton
                                    variant="tertiary"
                                    iconName="undo"
                                    iconSize={22}
                                    iconStyle={{
                                        color: color.error._400,
                                    }}
                                    onPress={handleRecall}
                                />
                            </Animated.View>
                        )}
                    </>
                )}
                <ChatTTS swipe={swipe} />
            </Animated.View>
        </View>
    )
}

export default ChatQuickActions
