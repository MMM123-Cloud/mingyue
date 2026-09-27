import { useRef, useState } from 'react'
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { Logger } from '@lib/state/Logger'
import { Theme } from '@lib/theme/ThemeManager'

type DirectEntry = {
    id: number
    isUser: boolean
    text: string
}

const DIRECT_SYSTEM_PROMPT = '直接对话模式，用中文自然回复。不要自称 Qwen、通义千问、阿里巴巴或语言模型；如果用户问你是谁，就说你是明月里的本地模型。'

const DirectChatScreen = () => {
    const { color, spacing, fontSize } = Theme.useTheme()
    const [entries, setEntries] = useState<DirectEntry[]>([])
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const nextId = useRef(0)
    const listRef = useRef<FlatList<DirectEntry>>(null)

    const ensureModel = async () => {
        const store = Llama.useLlamaModelStore.getState()
        if (store.context) return true
        const lastModel = Llama.useLlamaPreferencesStore.getState().lastModel
        if (!lastModel) {
            Logger.warnToast('还没有加载模型，先去模型页点一下加载')
            return false
        }
        await store.load(lastModel)
        return !!Llama.useLlamaModelStore.getState().context
    }

    const handleSend = async () => {
        const text = input.trim()
        if (!text || busy) return
        setInput('')

        const userEntry: DirectEntry = { id: nextId.current++, isUser: true, text }
        const replyEntry: DirectEntry = { id: nextId.current++, isUser: false, text: '' }
        const history = [...entries, userEntry]
        setEntries([...history, replyEntry])
        setBusy(true)

        try {
            if (!(await ensureModel())) return
            const context = Llama.useLlamaModelStore.getState().context
            if (!context) return

            const messages = [
                { role: 'system', content: DIRECT_SYSTEM_PROMPT },
                ...history.map((item) => ({
                    role: item.isUser ? 'user' : 'assistant',
                    content: item.text,
                })),
            ]

            const formatted = await context.getFormattedChat(messages, null, {
                jinja: true,
                enable_thinking: false,
            })
            const prompt = typeof formatted === 'string' ? formatted : formatted.prompt

            try {
                await context.clearCache(false)
            } catch (e) {
                Logger.warn('清缓存失败，继续生成')
            }

            await context.completion(
                {
                    prompt,
                    n_predict: 512,
                    seed: Math.floor(Math.random() * 2147483646),
                    temperature: 0.8,
                    top_p: 0.95,
                    top_k: 40,
                    min_p: 0.05,
                    penalty_last_n: 256,
                    penalty_repeat: 1.12,
                    penalty_present: 0.1,
                    penalty_freq: 0.05,
                    stop: ['<|im_end|>', '<|endoftext|>'],
                },
                (data) => {
                    setEntries((previous) =>
                        previous.map((item) =>
                            item.id === replyEntry.id
                                ? { ...item, text: item.text + data.token }
                                : item
                        )
                    )
                }
            )
        } catch (e) {
            Logger.errorToast('直接对话失败', e)
        } finally {
            setBusy(false)
        }
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <HeaderTitle title="直接对话" />
            <HeaderButton />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <FlatList
                    ref={listRef}
                    data={entries}
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        padding: spacing.m,
                        rowGap: spacing.s,
                    }}
                    keyExtractor={(item) => String(item.id)}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                    ListEmptyComponent={
                        <Text
                            style={{
                                color: color.text._500,
                                fontSize: fontSize.s,
                                textAlign: 'center',
                                marginTop: spacing.xl2,
                            }}>
                            不给模型任何人设和限制，直接对话。
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <View
                            style={{
                                alignSelf: item.isUser ? 'flex-end' : 'flex-start',
                                maxWidth: '86%',
                                backgroundColor: item.isUser
                                    ? color.primary._400
                                    : color.neutral._200,
                                borderColor: item.isUser ? color.primary._500 : color.neutral._400,
                                borderWidth: 1,
                                borderRadius: 14,
                                paddingVertical: spacing.m,
                                paddingHorizontal: spacing.l,
                            }}>
                            <Text
                                selectable
                                style={{
                                    color: color.text._100,
                                    fontSize: fontSize.l,
                                }}>
                                {item.text ||
                                    (busy && !item.isUser ? '' : '')}
                            </Text>
                        </View>
                    )}
                />
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        columnGap: spacing.s,
                        padding: spacing.m,
                        borderTopWidth: 1,
                        borderTopColor: color.neutral._300,
                    }}>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="直接对模型说话…"
                        placeholderTextColor={color.text._500}
                        multiline
                        style={{
                            flex: 1,
                            maxHeight: 140,
                            minHeight: 44,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: color.neutral._400,
                            backgroundColor: color.neutral._200,
                            color: color.text._100,
                            paddingHorizontal: spacing.l,
                            paddingVertical: spacing.m,
                            fontSize: fontSize.l,
                        }}
                    />
                    <Pressable
                        onPress={handleSend}
                        disabled={busy || input.trim().length === 0}
                        style={{
                            width: 48,
                            height: 44,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor:
                                busy || input.trim().length === 0
                                    ? color.neutral._300
                                    : color.primary._400,
                        }}>
                        {busy ? (
                            <ActivityIndicator color={color.text._100} />
                        ) : (
                            <Text style={{ color: color.text._100, fontSize: fontSize.l }}>↑</Text>
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

export default DirectChatScreen
