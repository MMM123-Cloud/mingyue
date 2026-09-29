import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { File, Paths } from 'expo-file-system'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { SafeAreaView } from 'react-native-safe-area-context'

import { GlassPanel } from '@lib/ui/Glass'
import HeaderTitle from '@components/views/HeaderTitle'
import HeaderButton from '@components/views/HeaderButton'
import ContextMenu from '@components/views/ContextMenu'
import Alert from '@components/views/Alert'
import { fitChatPrompt } from '@lib/engine/ChatBudget'
import { generateDirectChatAPI, DirectChatMessage } from '@lib/engine/DirectChatAPI'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { runtimeConfig } from '@lib/engine/Local/RuntimeConfig'
import { Storage } from '@lib/enums/Storage'
import { useAppMode } from '@lib/state/AppMode'
import { Logger } from '@lib/state/Logger'
import { mmkv } from '@lib/storage/MMKV'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'
import { downloadLocalFile } from '@lib/utils/Download'

type DirectEntry = { id: number; isUser: boolean; text: string }
const MAX_DIRECT_ENTRIES = 160
const SYSTEM_PROMPT = '你是明月中的 AI 助手。用中文自然、诚实地回复，保持连续对话。'
const readStoredEntries = (): DirectEntry[] => {
    try {
        const parsed = JSON.parse(mmkv.getString(Storage.DirectChat) ?? '[]')
        if (!Array.isArray(parsed)) return []
        return parsed
            .filter(
                (item) =>
                    item &&
                    Number.isSafeInteger(item.id) &&
                    typeof item.isUser === 'boolean' &&
                    typeof item.text === 'string'
            )
            .slice(-MAX_DIRECT_ENTRIES)
    } catch {
        return []
    }
}
const persist = (entries: DirectEntry[]) =>
    mmkv.set(Storage.DirectChat, JSON.stringify(entries.slice(-MAX_DIRECT_ENTRIES)))

async function exportEntries(entries: DirectEntry[]) {
    const file = new File(Paths.cache, `明月-直接对话-${Date.now()}.txt`)
    file.write(
        entries.map((entry) => `${entry.isUser ? '我' : '明月'}\n${entry.text}`).join('\n\n')
    )
    return await downloadLocalFile(file.uri)
}

const DirectChatScreen = () => {
    const { color } = Theme.useTheme()
    const { appMode } = useAppMode()
    const headerHeight = useHeaderHeight()
    const [entries, setEntries] = useState<DirectEntry[]>(readStoredEntries)
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const lock = useRef(false)
    const mounted = useRef(true)
    const controller = useRef<AbortController | null>(null)
    const nextId = useRef(entries.reduce((max, item) => Math.max(max, item.id + 1), 0))
    const list = useRef<FlatList<DirectEntry>>(null)
    const followLatest = useRef(true)
    const userScrolling = useRef(false)
    const model = Llama.useLlamaModelStore((state) => state.model)
    const loading = Llama.useLlamaModelStore((state) => state.loading)
    const [errorMessage, setErrorMessage] = useState('')

    const scrollToLatest = () => {
        if (followLatest.current) list.current?.scrollToEnd({ animated: false })
    }
    const exportChat = async () => {
        try {
            if (await exportEntries(entries)) Logger.infoToast('对话已导出')
        } catch (error) {
            Logger.errorToast('导出失败', error)
        }
    }
    const clearChat = () =>
        Alert.alert({
            title: '清空直接对话',
            description: '这会删除当前设备上的直接对话记录。可以先导出一份文本备份。',
            buttons: [
                { label: '取消' },
                {
                    label: '清空',
                    type: 'warning',
                    onPress: () => {
                        if (lock.current) return
                        persist([])
                        setEntries([])
                    },
                },
            ],
        })

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            controller.current?.abort()
        }
    }, [])

    const send = async () => {
        const text = input.trim()
        if (!text || lock.current) return
        lock.current = true
        followLatest.current = true
        setBusy(true)
        setErrorMessage('')
        const abort = new AbortController()
        controller.current = abort
        let history = entries
        let generated = ''
        let reply: DirectEntry | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        const render = () => {
            if (mounted.current && reply) setEntries([...history, { ...reply, text: generated }])
        }
        const appendToken = (token: string) => {
            generated += token
            if (!timer)
                timer = setTimeout(() => {
                    timer = undefined
                    render()
                }, 50)
        }
        try {
            if (appMode === 'local') {
                const store = Llama.useLlamaModelStore.getState()
                if (store.generating) throw new Error('模型正在回复另一条消息，请稍后重试。')
                if (!store.context) {
                    const last = Llama.useLlamaPreferencesStore.getState().lastModel
                    if (!last) throw new Error('请先到模型页导入并加载一个 GGUF 模型。')
                    await store.load(last)
                }
                if (!Llama.useLlamaModelStore.getState().context)
                    throw new Error('模型加载失败，请选择更小的模型。')
            }
            if (abort.signal.aborted) return
            const user = { id: nextId.current++, isUser: true, text }
            reply = { id: nextId.current++, isUser: false, text: '' }
            history = [...entries, user].slice(-MAX_DIRECT_ENTRIES)
            setInput('')
            persist(history)
            render()
            const apiHistory: DirectChatMessage[] = history.map((item) => ({
                role: item.isUser ? 'user' : 'assistant',
                content: item.text,
            }))
            if (appMode === 'remote') {
                await generateDirectChatAPI({
                    systemPrompt: SYSTEM_PROMPT,
                    history: apiHistory,
                    onToken: appendToken,
                    signal: abort.signal,
                })
            } else {
                const store = Llama.useLlamaModelStore.getState()
                const context = store.context!
                const preferences = Llama.useLlamaPreferencesStore.getState()
                const config = store.runtime ?? runtimeConfig(store.model!, preferences.config)
                const limit = Math.min(256, Math.floor(config.context_length / 4))
                const prompt = await fitChatPrompt(
                    SYSTEM_PROMPT,
                    apiHistory,
                    config.context_length - limit - 32,
                    async (messages) => {
                        const value = await context.getFormattedChat(messages, null, {
                            jinja: true,
                            enable_thinking: false,
                        })
                        return typeof value === 'string' ? value : value.prompt
                    },
                    async (value) => (await context.tokenize(value)).tokens.length
                )
                if (abort.signal.aborted) return
                const stop = () => {
                    void store.stopCompletion().catch(() => undefined)
                }
                abort.signal.addEventListener('abort', stop, { once: true })
                try {
                    await store.completion(
                        {
                            prompt,
                            n_predict: limit,
                            temperature: 0.8,
                            top_p: 0.95,
                            top_k: 40,
                            min_p: 0.05,
                            penalty_last_n: 128,
                            penalty_repeat: 1.12,
                            stop: ['<|im_end|>', '<|endoftext|>'],
                        },
                        appendToken,
                        (value) => {
                            generated = value
                        }
                    )
                } finally {
                    abort.signal.removeEventListener('abort', stop)
                }
            }
        } catch (error) {
            if (!abort.signal.aborted && mounted.current) {
                Logger.errorToast('对话未完成', error)
                setErrorMessage(error instanceof Error ? error.message : '对话未完成，请重试。')
                if (!generated) {
                    history = entries
                    setInput(text)
                }
            }
        } finally {
            if (timer) clearTimeout(timer)
            const final = reply && generated ? [...history, { ...reply, text: generated }] : history
            persist(final)
            if (mounted.current) {
                setEntries(final)
                setBusy(false)
            }
            lock.current = false
            if (controller.current === abort) controller.current = null
        }
    }

    return (
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <HeaderTitle title="明月" />
            <HeaderButton
                headerRight={() => (
                    <ContextMenu
                        triggerIcon="more"
                        accessibilityLabel="对话操作"
                        buttons={[
                            {
                                label: '导出对话文本',
                                icon: 'download',
                                disabled: busy || entries.length === 0,
                                onPress: (close) => {
                                    close()
                                    void exportChat()
                                },
                            },
                            {
                                label: '清空对话',
                                icon: 'delete',
                                variant: 'warning',
                                disabled: busy || entries.length === 0,
                                onPress: (close) => {
                                    close()
                                    clearChat()
                                },
                            },
                        ]}
                    />
                )}
            />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={headerHeight}>
                <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
                    <Text style={{ color: color.primary._700, fontSize: 12 }}>
                        {appMode === 'local'
                            ? loading
                                ? '正在加载本地模型…'
                                : model
                                  ? '离线 · ' + model.name
                                  : '本地模式 · 请先加载模型'
                            : 'API 模式 · 使用当前连接'}
                    </Text>
                </View>
                <FlatList
                    ref={list}
                    data={entries}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        padding: 20,
                        gap: 18,
                        flexGrow: 1,
                        width: '100%',
                        maxWidth: 780,
                        alignSelf: 'center',
                    }}
                    keyExtractor={(item) => String(item.id)}
                    onContentSizeChange={scrollToLatest}
                    onLayout={scrollToLatest}
                    onScrollBeginDrag={() => {
                        userScrolling.current = true
                    }}
                    onMomentumScrollBegin={() => {
                        userScrolling.current = true
                    }}
                    onScrollEndDrag={() => {
                        userScrolling.current = false
                    }}
                    onMomentumScrollEnd={() => {
                        userScrolling.current = false
                    }}
                    scrollEventThrottle={100}
                    onScroll={({ nativeEvent }) => {
                        if (!userScrolling.current) return
                        const { contentSize, contentOffset, layoutMeasurement } = nativeEvent
                        followLatest.current =
                            contentSize.height - contentOffset.y - layoutMeasurement.height < 96
                    }}
                    ListEmptyComponent={
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 12,
                                paddingBottom: 40,
                            }}>
                            <Image
                                source={require('../../assets/images/liquid-icon-foreground.png')}
                                style={{ width: 108, height: 108 }}
                            />
                            <Text
                                style={{ color: color.text._100, fontSize: 23, fontWeight: '600' }}>
                                从一句你好开始
                            </Text>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    justifyContent: 'center',
                                    gap: 8,
                                    marginTop: 12,
                                }}>
                                {['一起规划今天', '给我一个小灵感'].map((suggestion) => (
                                    <Pressable
                                        key={suggestion}
                                        accessibilityRole="button"
                                        onPress={() => setInput(suggestion)}
                                        style={{
                                            minHeight: 48,
                                            justifyContent: 'center',
                                            paddingHorizontal: 16,
                                            borderRadius: 24,
                                            backgroundColor: color.neutral._200,
                                        }}>
                                        <Text style={{ color: color.primary._700 }}>
                                            {suggestion}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text
                                style={{
                                    color: color.text._300,
                                    lineHeight: 24,
                                    textAlign: 'center',
                                }}>
                                聊聊今天，或问一个小问题。{'\n'}记录自动保存在这台设备。
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View
                            style={{
                                alignSelf: item.isUser ? 'flex-end' : 'flex-start',
                                maxWidth: '84%',
                                padding: 16,
                                borderRadius: 20,
                                backgroundColor: item.isUser
                                    ? withAlpha(color.primary._200, 'D8')
                                    : color.neutral._200,
                            }}>
                            {item.text ? (
                                <Text
                                    selectable
                                    style={{
                                        color: color.text._100,
                                        fontSize: 16,
                                        lineHeight: 25,
                                    }}>
                                    {item.text}
                                </Text>
                            ) : (
                                <ActivityIndicator
                                    accessibilityLabel="模型正在回复"
                                    color={color.primary._700}
                                />
                            )}
                        </View>
                    )}
                />
                {!!errorMessage && (
                    <Text
                        accessibilityRole="alert"
                        style={{ color: color.error._700, marginHorizontal: 24, marginBottom: 12 }}>
                        {errorMessage}
                    </Text>
                )}
                <GlassPanel
                    blur
                    style={{
                        marginHorizontal: 16,
                        marginBottom: 12,
                        padding: 8,
                        borderRadius: 28,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                        <TextInput
                            accessibilityLabel="消息"
                            value={input}
                            onChangeText={setInput}
                            placeholder="想聊些什么…"
                            placeholderTextColor={color.text._400}
                            multiline
                            style={{
                                flex: 1,
                                color: color.text._100,
                                fontSize: 16,
                                minHeight: 48,
                                maxHeight: 140,
                                paddingHorizontal: 12,
                                paddingVertical: 12,
                            }}
                        />
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={busy ? '停止回复' : '发送消息'}
                            accessibilityState={{ disabled: !busy && !input.trim() }}
                            disabled={!busy && !input.trim()}
                            onPress={busy ? () => controller.current?.abort() : send}
                            style={({ pressed }) => ({
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: color.primary._600,
                                opacity: pressed || (!busy && !input.trim()) ? 0.5 : 1,
                            })}>
                            <AntDesign
                                name={busy ? 'pause' : 'arrow-up'}
                                size={22}
                                color="#FFFFFF"
                            />
                        </Pressable>
                    </View>
                </GlassPanel>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}
export default DirectChatScreen
