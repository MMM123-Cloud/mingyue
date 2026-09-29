import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import ThemedButton from '@components/buttons/ThemedButton'
import Avatar from '@components/views/Avatar'
import AvatarViewer from '@components/views/AvatarViewer'
import Drawer from '@components/views/Drawer'
import SettingsDrawer from '@components/views/SettingsDrawer'
import { Characters } from '@lib/state/Characters'
import { Chats } from '@lib/state/Chat'
import { Logger } from '@lib/state/Logger'
import { useRelationshipStore } from '@lib/state/Relationships'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'
import { ChatImportSchema } from '@lib/utils/ChatSchema'
import { FileUtils } from '@lib/utils/File'
import ChatInput from '@screens/ChatScreen/ChatInput'
import ChatsDrawer from '@screens/ChatScreen/ChatsDrawer'
import ChatWindow from '@screens/ChatScreen/ChatWindow'

import AuthorNoteSheet from './AuthorNote'
import AuthorNoteEditor from './AuthorNote/AuthorNoteEditor'
import ChatEditor from './ChatWindow/ChatEditor'

const ChatScreen = () => {
    const { t } = useTranslation()
    const insets = useSafeAreaInsets()
    const { color } = Theme.useTheme()
    const { unloadCharacter, charId, charName, charImageId } = Characters.useCharacterStore(
        useShallow((state) => ({
            unloadCharacter: state.unloadCard,
            charId: state.id,
            charName: state.card?.name,
            charImageId: state.card?.image_id,
        }))
    )
    const userId = Characters.useUserStore(useShallow((state) => state.id))
    const intimacy = useRelationshipStore((state) =>
        charId ? (state.profiles[String(charId)]?.intimacy ?? 0) : 0
    )

    const { height } = useReanimatedKeyboardAnimation()
    const animatedStyle = useAnimatedStyle(() => {
        return {
            paddingBottom: Math.max(0, -height.value - insets.bottom),
            flex: 1,
        }
    })

    const { chatId, setId, resetId, scrollData } = Chats.useChat()

    const { showSettings, showChats } = Drawer.useDrawerStore(
        useShallow((state) => ({
            showSettings: state.values?.[Drawer.ID.SETTINGS],
            showChats: state.values?.[Drawer.ID.CHATLIST],
        }))
    )

    useEffect(() => {
        return () => {
            unloadCharacter()
            resetId()
        }
    }, [unloadCharacter, resetId])

    const handleImportChat = async () => {
        if (!charId || !userId) {
            Logger.errorToast(t('chat.import.errors.noChatCharacter'))
            return
        }
        const file = await FileUtils.pickText({ type: 'application/json' })
        if (!file.success) return
        const result = ChatImportSchema.safeParse(JSON.parse(file.data))
        if (!result.success) {
            Logger.errorToast(t('chat.import.errors.failedToImport'))
            return
        }
        const chat = result.data
        chat.character_id = charId
        chat.scroll_offset = 0
        delete chat.id
        chat.messages = chat.messages.map((message) => {
            delete message.id
            message.swipes = message.swipes.map((swipe) => {
                delete swipe.id
                return swipe
            })
            message.attachments = []
            Object.assign(message, { recalled_at: null, recalled_by: null })
            return message
        })

        if (chat.user_id) {
            const userExists = await Characters.db.query.card(chat.user_id)
            if (!userExists) {
                chat.user_id = null
            }
        }
        chat.last_modified = Date.now()
        Chats.db.mutate.cloneChat(
            chat as unknown as Parameters<typeof Chats.db.mutate.cloneChat>[0]
        )
    }

    const renderHeaderButtonRight = () => {
        return (
            !showSettings && (
                <>
                    {showChats && (
                        <ThemedButton
                            buttonStyle={{
                                marginRight: 0,
                            }}
                            iconName="upload"
                            variant="tertiary"
                            iconSize={20}
                            onPress={handleImportChat}
                        />
                    )}
                    <Drawer.Button drawerID={Drawer.ID.CHATLIST} openIcon="message" />
                </>
            )
        )
    }

    const renderHeaderButtonLeft = () => {
        return !showChats && <Drawer.Button drawerID={Drawer.ID.SETTINGS} />
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
            <Drawer.Gesture
                config={[
                    {
                        drawerID: Drawer.ID.CHATLIST,
                        openDirection: 'left',
                        closeDirection: 'right',
                    },
                    {
                        drawerID: Drawer.ID.SETTINGS,
                        openDirection: 'right',
                        closeDirection: 'left',
                    },
                ]}>
                <View
                    style={{
                        flex: 1,
                        paddingBottom: insets.bottom + 4,
                        backgroundColor: color.neutral._100,
                    }}>
                    <Animated.View style={animatedStyle}>
                        <View style={{ flex: 1 }}>
                            {typeof chatId === 'number' && (
                                <ChatWindow chatId={chatId} scrollData={scrollData} />
                            )}
                            <ChatInput />
                            <AvatarViewer />
                            <ChatEditor />
                            <AuthorNoteSheet />
                            <AuthorNoteEditor />

                            {!showSettings && !showChats && (
                                <View
                                    pointerEvents="box-none"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        zIndex: 20,
                                        paddingTop: insets.top + 6,
                                    }}>
                                    <View
                                        style={{
                                            marginHorizontal: 8,
                                            paddingHorizontal: 4,
                                            paddingVertical: 4,
                                            borderRadius: 24,
                                            backgroundColor: withAlpha(color.neutral._100, 'e8'),
                                            borderWidth: 1,
                                            borderColor: color.neutral._300,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            boxShadow: [
                                                {
                                                    offsetX: 0,
                                                    offsetY: 2,
                                                    spreadDistance: 0,
                                                    color: color.shadow,
                                                    blurRadius: 10,
                                                },
                                            ],
                                        }}>
                                        <View style={{ width: 48 }}>
                                            {renderHeaderButtonLeft()}
                                        </View>
                                        <View
                                            pointerEvents="none"
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                columnGap: 8,
                                            }}>
                                            <Avatar
                                                style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 10,
                                                }}
                                                targetImage={Characters.getImageDir(
                                                    charImageId ?? -1
                                                )}
                                            />
                                            <View style={{ flexShrink: 1, alignItems: 'center' }}>
                                                <Text
                                                    numberOfLines={1}
                                                    style={{
                                                        maxWidth: '100%',
                                                        color: color.text._100,
                                                        fontSize: 16,
                                                        fontWeight: '600',
                                                    }}>
                                                    {charName ?? t('common.brand.name')}
                                                </Text>
                                                <View
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        columnGap: 3,
                                                    }}>
                                                    <AntDesign
                                                        name="heart"
                                                        size={10}
                                                        color={color.primary._700}
                                                    />
                                                    <Text
                                                        numberOfLines={1}
                                                        style={{
                                                            color: color.text._500,
                                                            fontSize: 11,
                                                        }}>
                                                        {t('common.labels.intimacy')} {intimacy}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View
                                            style={{
                                                width: 88,
                                                flexDirection: 'row',
                                                justifyContent: 'flex-end',
                                            }}>
                                            {renderHeaderButtonRight()}
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </Animated.View>

                    {/**Drawer has to be outside of the KeyboardAvoidingView */}
                    <SettingsDrawer />
                    <ChatsDrawer />
                </View>
            </Drawer.Gesture>
        </>
    )
}

export default ChatScreen
