import MaterialIcons from '@react-native-vector-icons/material-icons/static'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Pressable, TextInput, TouchableOpacity, View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import ThemedButton from '@components/buttons/ThemedButton'
import { useBottomSheetRef } from '@components/views/BottomSheet'
import ContextMenu from '@components/views/ContextMenu'
import InputSheet from '@components/views/InputSheet'
import { XAxisOnlyTransition } from '@lib/animations/transitions'
import { AppSettings } from '@lib/constants/GlobalValues'
import { generateResponse } from '@lib/engine/Inference'
import { useActiveProvider } from '@lib/hooks/ActiveProvider'
import { useUnfocusTextInput } from '@lib/hooks/UnfocusTextInput'
import {
    buildGiftRejectionText,
    canAcceptGift,
    useRelationshipStore,
} from '@lib/state/Relationships'
import { Characters } from '@lib/state/Characters'
import { Chats, useInference } from '@lib/state/Chat'
import { useDeveloperContactStore } from '@lib/state/DeveloperContact'
import { useDeveloperModeStore } from '@lib/state/DeveloperMode'
import { useChatInputTextStore } from '@lib/state/components/ChatInput'
import { Logger } from '@lib/state/Logger'
import { useWalletStore } from '@lib/state/Wallet'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'

import ChatOptions from './ChatInputOptions'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

type ChatInputHeightStoreProps = {
    height: number
    setHeight: (n: number) => void
}

export const useInputHeightStore = create<ChatInputHeightStoreProps>()((set) => ({
    height: 54,
    setHeight: (n) => set({ height: Math.ceil(n) }),
}))

const ChatInput = () => {
    const { t } = useTranslation()
    const inputRef = useUnfocusTextInput()
    const { available: activeProvider, mode } = useActiveProvider()
    const { color, borderRadius, spacing } = Theme.useTheme()
    const [sendOnEnter] = useMMKVBoolean(AppSettings.SendOnEnter)
    const [disableSend, setDisableSend] = useState(false)
    const [hideOptions, setHideOptions] = useState(false)
    const transferSheetRef = useBottomSheetRef()
    const { nowGenerating, abortFunction } = useInference(
        useShallow((state) => ({
            nowGenerating: state.nowGenerating,
            abortFunction: state.abortFunction,
        }))
    )
    const setHeight = useInputHeightStore(useShallow((state) => state.setHeight))

    const { charId, charName, deletedAt } = Characters.useCharacterStore(
        useShallow((state) => ({
            charId: state?.card?.id,
            charName: state?.card?.name,
            deletedAt: state?.card?.deleted_at,
        }))
    )

    const { chatId } = Chats.useChat()

    const { userName } = Characters.useUserStore(
        useShallow((state) => ({ userName: state.card?.name }))
    )

    const { newMessage, setNewMessage } = useChatInputTextStore(
        useShallow((state) => ({
            newMessage: state.text,
            setNewMessage: state.setText,
        }))
    )

    const deletedContact = !!deletedAt
    const canInteract = activeProvider || deletedContact

    const abortResponse = async () => {
        Logger.info(t('chat.input.errors.abortGeneration'))
        if (abortFunction) await abortFunction()
    }

    const handleTransfer = async (text: string) => {
        if (deletedContact) return
        if (!chatId) return
        const [rawAmount, ...noteParts] = text.trim().split(/\s+/)
        const amount = Number(rawAmount)
        const note = noteParts.join(' ')
        if (!Number.isFinite(amount) || amount <= 0) {
            Logger.errorToast('请输入有效金额')
            return
        }
        if (
            !useDeveloperModeStore.getState().enabled &&
            amount > useWalletStore.getState().balance
        ) {
            Logger.errorToast('余额不足')
            return
        }
        const characterCard = charId ? await Characters.db.query.card(charId) : undefined
        const relationship = useRelationshipStore.getState()
        const relationshipProfile = relationship.profiles[String(charId ?? 0)]
        const accepted = canAcceptGift({
            characterId: charId ?? 0,
            name: characterCard?.name ?? charName ?? 'AI',
            personality: characterCard?.personality,
            description: characterCard?.description,
            amount,
            intimacy: relationshipProfile?.intimacy ?? 0,
            isPartner: relationship.partnerCharacterId === charId,
        })
        setDisableSend(true)
        try {
            if (!accepted) {
                await Chats.db.mutate.createEntry(
                    chatId,
                    userName ?? '',
                    true,
                    `[转账] ¥${amount.toFixed(2)} | 备注：${note || '无'}`,
                    []
                )
                await Chats.db.mutate.createEntry(
                    chatId,
                    charName ?? '',
                    false,
                    buildGiftRejectionText(
                        characterCard?.name ?? charName ?? 'AI',
                        characterCard?.personality,
                        amount
                    )
                )
                return
            }

            const ok = useWalletStore
                .getState()
                .transferToAI(amount, note, charId ?? 0, charName ?? 'AI')
            if (!ok) {
                Logger.errorToast('余额不足或金额无效')
                return
            }
            useRelationshipStore.getState().recordGiftTransfer(charId ?? 0, amount)
            await Chats.db.mutate.createEntry(
                chatId,
                userName ?? '',
                true,
                `[转账] ¥${amount.toFixed(2)} | 备注：${note || '无'}`,
                []
            )
            const result = await Chats.db.mutate.createEntry(chatId, charName ?? '', false, '')
            const swipeId = result?.swipes?.[0]?.id
            if (swipeId) generateResponse(swipeId)
        } catch (e) {
            Logger.errorToast('转账失败')
            Logger.error(e)
        } finally {
            setDisableSend(false)
        }
    }

    const handleSend = async () => {
        Keyboard.dismiss()
        if (!chatId) return
        if (newMessage.trim() === '') return
        if (useDeveloperModeStore.getState().unlockWithPhrase(newMessage)) {
            useDeveloperContactStore.getState().sendUnlockSurprise()
            setNewMessage('')
            Logger.infoToast('开发者模式已开启')
            return
        }
        setDisableSend(true)
        try {
            await Chats.db.mutate.createEntry(chatId, userName ?? '', true, newMessage, [])
            setNewMessage('')

            if (deletedContact) {
                await Chats.db.mutate.createEntry(
                    chatId,
                    charName ?? '',
                    false,
                    t('character.list.deleted')
                )
                return
            }

            const result = await Chats.db.mutate.createEntry(chatId, charName ?? '', false, '')
            const swipeId = result?.swipes?.[0]?.id
            if (swipeId) generateResponse(swipeId)
        } catch (e) {
            Logger.errorToast(t('chat.input.errors.failedToSend'))
            Logger.error(e)
        } finally {
            setDisableSend(false)
        }
    }

    return (
        <Pressable
            onPress={() => {
                if (deletedContact) return
                if (activeProvider) return
                if (mode === 'local') {
                    router.push('/screens/ModelManagerScreen')
                } else router.push('/screens/ConnectionsManagerScreen')
            }}
            onLayout={(e) => {
                setHeight(e.nativeEvent.layout.height)
            }}
            disabled={activeProvider}
            style={{
                position: 'absolute',
                width: '96%',
                alignSelf: 'center',
                bottom: 8,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                backgroundColor: withAlpha(color.neutral._100, 'e6'),
                borderWidth: 1,
                borderColor: color.neutral._300,
                boxShadow: [
                    {
                        offsetX: 0,
                        offsetY: 3,
                        color: color.shadow,
                        spreadDistance: 0,
                        blurRadius: 12,
                    },
                ],
                borderRadius: 24,
                rowGap: spacing.m,
            }}>
            <InputSheet
                ref={transferSheetRef}
                title="转账给 AI（模拟）"
                description="输入金额和备注，例如：20 请喝奶茶"
                placeholder="20 请喝奶茶"
                confirmLabel="转账"
                autoFocus
                verifyText={(text) => {
                    const [rawAmount] = text.trim().split(/\s+/)
                    const amount = Number(rawAmount)
                    if (!Number.isFinite(amount) || amount <= 0) return '请输入有效金额'
                    const hasEnoughBalance =
                        useDeveloperModeStore.getState().enabled ||
                        amount <= useWalletStore.getState().balance
                    if (!hasEnoughBalance) return '余额不足'
                    return ''
                }}
                onConfirm={handleTransfer}
            />
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    columnGap: spacing.m,
                }}>
                <Animated.View layout={XAxisOnlyTransition}>
                    {!hideOptions && (
                        <Animated.View
                            entering={FadeIn}
                            exiting={FadeOut}
                            style={{
                                flexDirection: 'row',
                                columnGap: 8,
                                alignItems: 'center',
                            }}>
                            <ChatOptions disabled={!activeProvider} />
                            <ContextMenu
                                disabled={!activeProvider || deletedContact}
                                triggerIcon="wallet"
                                triggerIconSize={20}
                                buttons={[
                                    {
                                        label: '转账（模拟）',
                                        icon: 'wallet',
                                        onPress: (close) => {
                                            close()
                                            transferSheetRef.current?.open()
                                        },
                                    },
                                ]}
                                triggerStyle={{
                                    color: color.text._400,
                                    padding: 6,
                                    backgroundColor: color.neutral._200,
                                    borderRadius: 16,
                                    opacity: activeProvider ? 1 : 0.5,
                                }}
                                placement="top"
                            />
                        </Animated.View>
                    )}
                    {hideOptions && (
                        <Animated.View entering={FadeIn} exiting={FadeOut}>
                            <ThemedButton
                                iconSize={18}
                                iconStyle={{
                                    color: color.text._400,
                                }}
                                buttonStyle={{
                                    padding: 5,
                                    backgroundColor: color.neutral._200,
                                    borderRadius: 32,
                                }}
                                variant="tertiary"
                                iconName="right"
                                onPress={() => setHideOptions(false)}
                            />
                        </Animated.View>
                    )}
                </Animated.View>
                <AnimatedTextInput
                    layout={XAxisOnlyTransition}
                    ref={inputRef}
                    style={{
                        color: color.text._100,
                        backgroundColor: color.neutral._200,
                        flex: 1,
                        borderWidth: 2,
                        borderColor: canInteract ? color.primary._300 : color.primary._100,
                        borderRadius: 20,
                        paddingHorizontal: spacing.l,
                        paddingVertical: spacing.l,
                    }}
                    onPress={() => {
                        setHideOptions(!!newMessage)
                    }}
                    numberOfLines={8}
                    placeholder={
                        deletedContact
                            ? t('character.list.deleted')
                            : activeProvider
                              ? t('chat.input.message')
                              : mode === 'local'
                                ? t('chat.input.noModelLoaded')
                                : t('chat.input.noConnection')
                    }
                    editable={canInteract}
                    placeholderTextColor={color.text._700}
                    value={newMessage}
                    onChangeText={(text) => {
                        setHideOptions(!!text)
                        setNewMessage(text)
                    }}
                    multiline
                    submitBehavior={sendOnEnter ? 'blurAndSubmit' : 'newline'}
                    onSubmitEditing={sendOnEnter ? handleSend : undefined}
                />
                <Animated.View layout={XAxisOnlyTransition}>
                    <TouchableOpacity
                        disabled={disableSend || !chatId || !canInteract}
                        style={{
                            borderRadius: 20,
                            backgroundColor: !canInteract
                                ? color.neutral._100
                                : nowGenerating
                                  ? color.error._500
                                  : color.primary._500,
                            padding: 10,
                            borderWidth: 2,
                            borderColor: !canInteract
                                ? color.primary._100
                                : nowGenerating
                                  ? color.error._500
                                  : color.primary._500,
                        }}
                        onPress={nowGenerating ? abortResponse : handleSend}>
                        <MaterialIcons
                            name={nowGenerating ? 'stop' : 'send'}
                            color={canInteract ? color.neutral._100 : color.text._700}
                            size={24}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Pressable>
    )
}

export default ChatInput
