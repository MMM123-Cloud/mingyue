import { t } from 'i18next'

import { getContentRules } from '@lib/constants/ContentRules'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { getContentModeForModel, useContentModeStore } from '@lib/state/ContentMode'
import { AppSettings } from '@lib/constants/GlobalValues'
import { buildThinkRules } from '@lib/markdown/ThinkTags'
import { useAppModeStore } from '@lib/state/AppMode'
import { buildRelationshipToneGuide, useRelationshipStore } from '@lib/state/Relationships'
import { CharacterCardData, CharacterTokenCache } from '@lib/state/Characters'
import { ChatEntry } from '@lib/state/Chat'
import { defaultSystemPromptFormat, InstructTokenCache, InstructType } from '@lib/state/Instructs'
import { Logger } from '@lib/state/Logger'
import { replaceMacros } from '@lib/state/Macros'
import { getNetworkDate } from '@lib/utils/NetworkTime'
import { mmkv } from '@lib/storage/MMKV'
import { readBase64Async } from '@lib/utils/File'
import { Macro } from '@lib/utils/Macros'

import { APIConfiguration, APIValues } from './APIBuilder.types'
import type { DataSource, DataSourceResult } from '../DataSources/types'

export type MessageLoader = {
    retrieve: (page: number) => Promise<ChatEntry[]> // must retrieve messages in chronological order from oldest to newest
    pageSize: number // we use this to determine if a last page has been reached, if (await retrieve()).length < pageSize
    initialPage: number // usually 0
}

export type TokenCache = {
    userCache: CharacterTokenCache
    characterCache: CharacterTokenCache
    instructCache: InstructTokenCache
}

const printContext = (context: string) => {
    if (!mmkv.getBoolean(AppSettings.PrintContext)) return
    Logger.info('Input Context')
    Logger.info(JSON.stringify(context))
}

export interface ContextBuilderParams {
    apiConfig: APIConfiguration
    apiValues: APIValues
    messages: ChatEntry[]
    character: CharacterCardData
    instruct: InstructType
    user: CharacterCardData
    tokenizer: (data: string, media_paths?: string[]) => Promise<number> | number
    chatTokenizer: (entry: ChatEntry, index: number) => Promise<number>
    maxLength: number
    cache: TokenCache
    bypassContextLength?: boolean
    messageLoader?: MessageLoader
    dataSources?: DataSource[]
}

type TextData = { type: 'input_text' | 'text'; text: string }
type ImageData = { type: 'image_url'; image_url: { url: string } }
type AudioData = { type: 'input_audio'; input_audio: { data: string; format: string } }

type ContentTypes = TextData | ImageData | AudioData

export type Message = { role: string; [x: string]: ContentTypes[] | string }

export const buildContext = async (params: ContextBuilderParams) => {
    const buildFn =
        params.apiConfig.request.completionType.type === 'chatCompletions'
            ? buildChatCompletionContext
            : buildTextCompletionContext
    const output = await buildFn(params)
    return output
}

export type ContextMessage = {
    role: 'user' | 'assistant'
    content: string
    attachments?: ContentTypes[]
}

export type CompletionState =
    | 'initial_truncated'
    | 'initial_completed'
    | 'loader_completed'
    | 'loader_truncated'

export const collectContext = async (params: ContextBuilderParams & { mode: 'chat' | 'text' }) => {
    const {
        apiConfig,
        messages,
        character,
        user,
        cache,
        instruct,
        tokenizer,
        chatTokenizer,
        maxLength,
        bypassContextLength,
        messageLoader,
        mode,
        dataSources,
    } = params

    // Never trust the caller's row order. Feed the model oldest-to-newest.
    const chronologicalMessages = [...messages].sort((a, b) => a.id - b.id)

    const normalizeForDuplicateCheck = (text: string) =>
        text.replace(/[\s，。！？、；：,.!?;:"“”‘’（）()【】\[\]…—\-]+/g, '')
    const getNgrams = (text: string, size = 4) => {
        const result = new Set<string>()
        for (let i = 0; i + size <= text.length; i++) result.add(text.slice(i, i + size))
        return result
    }
    const isNearDuplicate = (leftText: string, rightText: string) => {
        const left = normalizeForDuplicateCheck(leftText)
        const right = normalizeForDuplicateCheck(rightText)
        if (left.length < 24 || right.length < 24) return false
        if (left === right) return true
        const leftNgrams = getNgrams(left)
        const rightNgrams = getNgrams(right)
        let shared = 0
        leftNgrams.forEach((gram) => {
            if (rightNgrams.has(gram)) shared++
        })
        const union = leftNgrams.size + rightNgrams.size - shared
        return union > 0 && shared / union >= 0.6
    }
    const assistantHistory = chronologicalMessages.filter(
        (item) => !item.is_user && !item.recalled_at && !!item.swipes[0]?.swipe
    )
    const duplicateAssistantIds = new Set<number>()
    let previousAssistantText = ''
    for (const item of assistantHistory) {
        const text = item.swipes[0]?.swipe ?? ''
        if (previousAssistantText && isNearDuplicate(text, previousAssistantText)) {
            duplicateAssistantIds.add(item.id)
        }
        previousAssistantText = text
    }
    const hasDuplicateAssistant = duplicateAssistantIds.size > 0

    // A repeated assistant paragraph can dominate the next prediction. For one turn, feed
    // only the newest user entry so there is no old assistant wording to copy.
    const contextSourceMessages = hasDuplicateAssistant
        ? chronologicalMessages
              .filter((item) => item.is_user && !item.recalled_at && !!item.swipes[0]?.swipe)
              .slice(-1)
        : chronologicalMessages
    const effectiveMessageLoader = hasDuplicateAssistant ? undefined : messageLoader

    const delta = performance.now()

    const { characterCache, userCache, instructCache } = cache

    const usePrefix = mode === 'text'
    const useSuffix = false

    const sortedDataSources = [...(dataSources ?? [])].sort((a, b) => a.priority - b.priority)

    let { systemPrompt, systemPromptLength, volatilePrompt } = getSystemPrompt({
        instruct,
        user,
        character,
        userCache,
        characterCache,
        instructCache,
        usePrefix,
        useSuffix,
    })

    if (hasDuplicateAssistant) {
        volatilePrompt +=
            '\n【避免复读】你最近两轮的回复高度重复。不要复述上一轮的句子、动作或结尾，直接回应用户最新一句。'
    }

    // Measure the real prompt with the model tokenizer instead of estimating by characters.
    systemPromptLength = await tokenizer(systemPrompt)
    const volatilePromptLength = volatilePrompt ? await tokenizer(volatilePrompt) : 0

    const reservedBudget = sortedDataSources.reduce((acc, curr) => acc + curr.tokenBudget, 0)

    let totalLength = systemPromptLength + reservedBudget + volatilePromptLength + 16

    let hasImage = false
    let completionState: CompletionState = 'initial_completed'

    const contextMessages: ContextMessage[] = []

    /**
     * Shared processor
     */
    const processMessage = async (
        message: ChatEntry,
        index: number,
        isLast: boolean
    ): Promise<boolean> => {
        if (message.recalled_at) return true
        const swipe = message.swipes[0]
        if (!swipe) {
            Logger.errorToast(t('generation.warn.entryWithoutValidSwipeFound'))
            return false
        }
        // The assistant placeholder is empty until generation fills it. Skip it
        // before the context budget check, otherwise it can hide the newest user message.
        if (!swipe.swipe && isLast) {
            return true
        }
        if (!message.is_user && duplicateAssistantIds.has(message.id)) {
            return true
        }

        const swipeLen = await chatTokenizer(message, index)

        const timestamp = instruct.timestamp
            ? `[${swipe.send_date.toDateString()} ${swipe.send_date.toLocaleTimeString()}]\n`
            : ''

        const name = instruct.names ? `${message.name}: ` : ''

        const timestampLen = instruct.timestamp ? await tokenizer(timestamp) : 0
        const nameLen = instruct.names ? await tokenizer(name) : 0

        let instructLen = 0
        if (mode === 'text') {
            instructLen += message.is_user
                ? instructCache.input_prefix_length
                : instructCache.output_prefix_length
        }

        const shardLen = swipeLen + timestampLen + nameLen + instructLen

        // HARD LIMIT (always enforced)
        if (totalLength + shardLen > maxLength && !bypassContextLength) {
            return false
        }

        const role: 'user' | 'assistant' = message.is_user ? 'user' : 'assistant'

        const avoidRepeatTail = hasDuplicateAssistant && isLast && message.is_user
            ? '\n[直接回应上一条最新消息，不要复述任何上一轮助手回复、动作或结尾。]'
            : ''

        const content = replaceMacrosInternal(
            `${timestamp}${name}${swipe.swipe}${avoidRepeatTail}`,
            instruct
        )

        let attachments: ContentTypes[] | undefined

        if (mode === 'chat' && apiConfig.request.completionType.type === 'chatCompletions') {
            const result = getValidAttachments(
                message,
                apiConfig.request.completionType,
                instruct,
                hasImage
            )

            hasImage = result.hasImageNew

            if (result.attachments.length > 0) {
                attachments = await Promise.all(
                    result.attachments.map(async (item) => {
                        const base64 = await readBase64Async(item.uri)

                        if (item.type === 'image') {
                            return {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${item.mime_type};base64,${base64}`,
                                },
                            }
                        }

                        return {
                            type: 'input_audio',
                            input_audio: {
                                data: base64,
                                format: item.mime_type.split('/')[1],
                            },
                        }
                    })
                )
            }
        }

        contextMessages.push({ role, content, attachments })

        totalLength += shardLen

        return true
    }

    // initial message collector
    let index = contextSourceMessages.length - 1

    for (let i = contextSourceMessages.length - 1; i >= 0; i--) {
        const success = await processMessage(
            contextSourceMessages[i],
            index,
            i === contextSourceMessages.length - 1
        )

        if (!success) {
            completionState = 'initial_truncated'
            break
        }
        index--
    }

    if (effectiveMessageLoader && completionState === 'initial_completed') {
        let page = effectiveMessageLoader.initialPage
        while (true) {
            let batch: ChatEntry[] | null = null

            batch = await effectiveMessageLoader.retrieve(page)

            for (let i = batch.length - 1; i >= 0; i--) {
                const success = await processMessage(batch[i], -1, false)
                if (!success) {
                    completionState = 'loader_truncated'
                    break
                }
            }

            if (completionState === 'loader_truncated') break

            if (batch.length < effectiveMessageLoader.pageSize || batch.length === 0) {
                completionState = 'loader_completed'
                break
            }

            page++
        }
    }

    const lastMessageReached =
        completionState === 'loader_completed' || completionState === 'initial_completed'

    const pendingInsertions: DataSourceResult[] = []

    const runDataSources = async (sources: DataSource[]) => {
        for (const source of sources) {
            const remaining = maxLength - totalLength
            const opportunistic = source.tokenBudget === 0
            if (remaining <= 0 && opportunistic) {
                Logger.info(`[DataSource:${source.name}] skipped (no remaining budget)`)
                continue
            }

            const budget = opportunistic ? remaining : source.tokenBudget

            const results = await source.retrieve(
                params,
                contextMessages,
                maxLength,
                totalLength,
                budget,
                lastMessageReached
            )
            for (const result of results) {
                pendingInsertions.push(result)
                totalLength += result.tokenLength

                Logger.info(
                    `[DataSource:${source.name}] inserted ${result.tokenLength} tokens from ${result.source}`
                )
            }
        }
    }

    await runDataSources(sortedDataSources)

    const insertMessage = (index: number, message: ContextMessage) => {
        contextMessages.splice(index, 0, message)
    }

    for (const insertion of pendingInsertions) {
        const syntheticMessage: ContextMessage = {
            role: 'user',
            content: insertion.content,
        }

        if (insertion.position.type === 'relative') {
            switch (insertion.position.location) {
                case 'afterLast':
                    contextMessages.push(syntheticMessage)
                    break

                case 'beforeLast':
                    contextMessages.splice(
                        Math.max(contextMessages.length - 1, 0),
                        0,
                        syntheticMessage
                    )
                    break

                case 'afterSystem':
                    systemPrompt += '\n' + insertion.content
                    break
            }

            continue
        }

        const index = insertion.position.location

        if (index >= contextMessages.length) {
            contextMessages.unshift(syntheticMessage)
        } else {
            insertMessage(index, syntheticMessage)
        }
    }

    Logger.info(`Approximate Context Size: ${totalLength}`)
    Logger.info(`${(performance.now() - delta).toFixed(2)}ms`)

    if (contextMessages.length === 0) warnNoMessages()
    const orderedMessages = contextMessages.reverse()
    Logger.info(
        `[PromptTail] ${orderedMessages
            .slice(-4)
            .map((item) => `${item.role}:${item.content.slice(0, 20).replace(/\n/g, ' ')}`)
            .join(' | ')}`
    )
    // Volatile state (network time, intimacy guide, relationship facts) belongs at the tail of
    // the prompt instead of the system prompt. A system prompt that changes every turn
    // invalidates the prompt prefix, so the local model reprocesses the whole conversation
    // instead of reusing its KV cache. Keeping it last makes follow-up replies much faster.
    if (volatilePrompt) {
        const lastMessage = orderedMessages[orderedMessages.length - 1]
        if (lastMessage && lastMessage.role === 'user') {
            lastMessage.content += `\n\n【实时状态（仅你可见）】\n${volatilePrompt}`
        } else {
            systemPrompt += `\n${volatilePrompt}`
        }
    }
    return {
        systemPrompt: systemPrompt,
        messages: orderedMessages,
    }
}

export const buildChatCompletionContext = async (params: ContextBuilderParams) => {
    if (params.apiConfig.request.completionType.type !== 'chatCompletions') return

    const { systemPrompt, messages } = await collectContext({
        ...params,
        mode: 'chat',
    })

    const feats = params.apiConfig.request.completionType

    const payload: Message[] = [
        {
            role: feats.systemRole,
            [feats.contentName]: replaceMacrosInternal(systemPrompt, params.instruct),
        },
    ]

    for (const msg of messages) {
        if (msg.attachments?.length) {
            payload.push({
                role: msg.role,
                [feats.contentName]: [{ type: 'text', text: msg.content }, ...msg.attachments],
            })
        } else {
            payload.push({
                role: msg.role,
                [feats.contentName]: msg.content,
            })
        }
    }
    printContext(
        JSON.stringify(
            payload.map((item) => {
                const content = item[feats.contentName]
                if (typeof content === 'string') return item
                else return content.filter((item) => item.type === 'text')
            })
        )
    )
    return payload
}

export const buildTextCompletionContext = async (params: ContextBuilderParams) => {
    const { systemPrompt, messages } = await collectContext({
        ...params,
        mode: 'text',
    })

    const { instruct } = params
    let hasMedia = false
    let output = systemPrompt + instruct.system_suffix
    let len = 0
    let endedAtAssistant = false
    for (const msg of messages) {
        let outPrefix = instruct.output_prefix
        let outSuffix = instruct.output_suffix
        if (len === messages.length - 1 && msg.role === 'assistant') {
            outPrefix = instruct.last_output_prefix
            outSuffix = ''
            endedAtAssistant = true
        }

        let shard = msg.role === 'user' ? instruct.input_prefix : outPrefix

        shard += msg.content

        shard += msg.role === 'user' ? instruct.input_suffix : outSuffix

        if (instruct.wrap && !endedAtAssistant) shard += '\n'
        if (!hasMedia && msg.attachments?.length) {
            hasMedia = true
        }
        output += shard
        len++
    }
    if (hasMedia) {
        Logger.errorToast('Text Completions does not support multimodal')
        if (useAppModeStore.getState().appMode === 'local') {
            Logger.warn(
                "[HINT] You probably have built-in templates disabled. Enable it in 'Formatting > Use Built-In Local Model' template"
            )
        }
    }

    if (!endedAtAssistant) output += instruct.last_output_prefix
    const result = replaceMacrosInternal(output, instruct)
    printContext(result)
    return result
}

const thinkRule = buildThinkRules()

const getMacroRules = (instruct: InstructType) => {
    const data: Macro[] = []
    if (instruct.hide_think_tags) {
        data.push(...thinkRule)
    }
    // for expansion
    return data
}

const replaceMacrosInternal = (data: string, instruct: InstructType) => {
    return replaceMacros(data, { extraMacros: getMacroRules(instruct) })
}

const getValidAttachments = (
    entry: ChatEntry,
    config: {
        type: 'chatCompletions'
        userRole: string
        systemRole: string
        assistantRole: string
        contentName: string
        supportsAudio?: boolean
        supportsImages?: boolean
    },
    instruct: InstructType,
    hasImage: boolean
) => {
    // hasImage is used for last_image_only checking
    let hasImageNew = hasImage
    const audioAttachments = entry.attachments.filter(
        (item) => item.type === 'audio' && instruct.send_audio && config.supportsAudio
    )

    let imageAttachments: typeof entry.attachments = []
    if (instruct.send_images && config.supportsImages) {
        const images = entry.attachments.filter((item) => item.type === 'image')
        if (instruct.last_image_only && images.length > 0) {
            if (!hasImageNew) {
                hasImageNew = true
                imageAttachments = [images[0]]
            }
        } else {
            imageAttachments = images
        }
    }
    const attachments = [...audioAttachments, ...imageAttachments]
    return { hasImageNew, attachments }
}

export const getSystemPrompt = ({
    instruct,
    user,
    character,
    userCache,
    characterCache,
    instructCache,
    usePrefix = true,
    useSuffix = true,
}: {
    instruct: InstructType
    user?: CharacterCardData
    character?: CharacterCardData
    userCache: CharacterTokenCache
    characterCache: CharacterTokenCache
    instructCache: InstructTokenCache
    usePrefix?: boolean
    useSuffix?: boolean
}) => {
    let systemPrompt = instruct.system_prompt_format
    if (systemPrompt === undefined) {
        Logger.warn('System Prompt Format is undefined, falling back to default')
        systemPrompt = defaultSystemPromptFormat
    }
    if (systemPrompt === '') {
        Logger.warn('System Prompt Format is blank')
    }

    let systemPromptLength = 0
    const macros = [
        {
            macro: '{{system_prefix}}',
            value: (usePrefix && instruct.system_prefix) || '',
            length: instructCache.system_prefix_length,
        },
        {
            macro: '{{system_suffix}}',
            value: (useSuffix && instruct.system_suffix) || '',
            length: instructCache.system_suffix_length,
        },
        {
            macro: '{{system_prompt}}',
            value: instruct.system_prompt ?? '',
            length: instructCache.system_suffix_length,
        },
        {
            macro: '{{character_desc}}',
            value: character?.description ?? '',
            length: characterCache.description_length,
        },
        {
            macro: '{{user_desc}}',
            value: user?.description ?? '',
            length: userCache.description_length,
        },
        {
            macro: '{{personality}}',
            value: instruct.personality ? (character?.personality ?? '') : '',
            length: instruct.personality ? characterCache.personality_length : 0,
        },
        {
            macro: '{{scenario}}',
            value: instruct.scenario ? (character?.scenario ?? '') : '',
            length: instruct.scenario ? characterCache.scenario_length : 0,
        },
    ]
    macros.forEach((m) => {
        systemPrompt = systemPrompt.replaceAll(m.macro, m.value)
        systemPromptLength += m.length
    })
    const contentModePreference = useContentModeStore.getState().preference
    const loadedModel = Llama.useLlamaModelStore.getState().model
    const contentMode =
        contentModePreference === 'auto'
            ? getContentModeForModel(`${loadedModel?.file ?? ''} ${loadedModel?.name ?? ''}`)
            : contentModePreference
    const contentRules = getContentRules(contentMode).replaceAll(
        '{{char}}',
        character?.name ?? '当前角色'
    )
    systemPrompt += contentRules
    systemPromptLength += 520
    const relationship = character?.id ? useRelationshipStore.getState() : undefined
    const relationshipProfile = relationship?.profiles[String(character?.id)]
    const isPartner = relationship?.partnerCharacterId === character?.id
    const relationshipToneGuide = buildRelationshipToneGuide({
        personality: character?.personality,
        description: character?.description,
        intimacy: relationshipProfile?.intimacy ?? 0,
        personaClarity: relationshipProfile?.personaClarity ?? 0,
        isPartner,
    })
    const relationshipRules = [
        `【当前联网时间】${formatNetworkTime(getNetworkDate())}`,
        '联系人的问候、作息、主动联系和日常安排必须与当前本地时间一致；如果此刻不适合你主动说话，就保持安静，不要硬发消息。',
        '【人设自总结规则】',
        '你的核心人设不可被用户改写，也不得与自己原有设定冲突。',
        '随着相处，你可以自己总结并稳定自己的语气、偏好、边界和亲密方式；不要向用户展示总结过程。',
        relationshipToneGuide,
        isPartner
            ? '你和用户现在是唯一情侣关系。保持专一，不与其他联系人发展情侣关系。'
            : '你当前不是用户的固定情侣；除非人设和互动自然支持，否则不要默认已经建立情侣关系。',
    ].join('\n')
    let volatilePrompt = relationshipRules
    systemPromptLength += relationshipRules.length

    const relationshipFacts = [
        relationshipProfile?.birthday ? `你的生日：${relationshipProfile.birthday}` : '',
        relationship?.userBirthday && relationshipProfile?.knowsUserBirthday
            ? `你知道用户的生日：${relationship.userBirthday}`
            : '',
    ]
        .filter(Boolean)
        .join('\n')
    if (relationshipFacts) {
        volatilePrompt += `\n【关系资料】\n${relationshipFacts}`
        systemPromptLength += 80
    }
    return { systemPrompt, systemPromptLength, volatilePrompt }
}

const formatNetworkTime = (date: Date) => {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const warnNoMessages = () => {
    Logger.warnToast(t('generation.warn.noMessagesAddedCheckLogs'))
    Logger.warn(
        'No messages were added to the context. This can be caused by:\n- Generated Length is too high, lower it in Formatting\n- Your context length is too low\n- Your first message is too long'
    )
}
