import { AuthorNotes } from '@lib/state/AuthorNotes'
import { Chats } from '@lib/state/Chat'
import { Memories } from '@lib/state/Memories'
import { rankMemoriesForContext } from '@lib/state/MemoryRecall'
import { replaceMacros } from '@lib/state/Macros'
import { getNetworkNow } from '@lib/utils/NetworkTime'

import { Tokenizer } from '../Tokenizer'
import createLorebookDataSource from './lorebookSource'
import { DataSource, DataSourceResult } from './types'

export const createExampleDataSource = (): DataSource => ({
    name: 'character_examples',
    priority: 1000,
    tokenBudget: 0,

    retrieve: async (
        params,
        messages,
        maxLength,
        currentLength,
        tokenBudget,
        lastMessageReached
    ) => {
        if (!lastMessageReached) return []

        const { character, instruct, cache } = params
        if (!instruct.examples) return []

        const examples = character?.mes_example
        if (!examples) return []

        const { characterCache } = cache
        const tokenLength = characterCache.examples_length

        if (currentLength + tokenLength > maxLength) {
            return []
        }

        return [
            {
                content: replaceMacros(examples),
                source: 'character_examples',
                tokenLength: tokenLength,
                position: {
                    type: 'relative',
                    location: 'afterSystem',
                },
            },
        ]
    },
})

const AUTHOR_NOTE_NAME = 'author_notes'
const CONTACT_MEMORY_NAME = 'contact_memories'
const createContactMemoryDataSource = async (): Promise<DataSource | undefined> => {
    const { id: chatId } = Chats.useChatState.getState()
    if (!chatId) return
    const chatData = await Chats.db.query.chatShallow(chatId)
    if (!chatData) return

    // 先取一个较宽的候选池，再在 retrieve 里按当前对话重排。只看重要度会让注入
    // 的记忆和正在聊的话题无关。
    const candidateMemories = await Memories.db.query.forContext(chatData.character_id)
    if (candidateMemories.length === 0) return

    return {
        name: CONTACT_MEMORY_NAME,
        priority: 3,
        tokenBudget: 0,
        retrieve: async (
            params,
            messages,
            maxLength,
            currentLength,
            tokenBudget,
            lastMessageReached
        ) => {
            if (!lastMessageReached) return []

            const available = Math.max(0, Math.min(tokenBudget, 1200, maxLength - currentLength))
            if (available <= 0) return []

            const characterName = params.character?.name ?? '联系人'
            const header = `[${characterName}的长期印象 - 不是数据库，也不是逐字档案。只在与当前话题有关时自然想起；普通小事可能淡忘、模糊或记错，重要且反复出现的经历更清楚。不要逐条复述，也不要假装什么都记得。]\n`
            const tokenizer = Tokenizer.getTokenizer()
            const recentContext = messages.map((message) => message.content).join('\n')
            const queryText = messages
                .slice(-6)
                .map((message) => message.content)
                .join('\n')
            const now = getNetworkNow()
            const memories = rankMemoriesForContext(candidateMemories, { queryText, now })
            const usedMemoryIds: number[] = []
            const lines: string[] = []
            let usedTokens = await tokenizer(header)

            for (const memory of memories) {
                const maxContentLength = memory.importance >= 75 ? 1200 : 600
                const content = memory.content
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, maxContentLength)
                if (!content || recentContext.includes(content.slice(0, 48))) continue
                if (lines.length >= 18) break

                const prefix =
                    memory.speaker === 'user'
                        ? `用户对${characterName}说过`
                        : `${characterName}曾说过`
                const confidence =
                    memory.importance >= 80
                        ? '印象很清楚'
                        : memory.importance >= 55
                          ? '大概记得'
                          : '只剩模糊印象'
                const line = `- [${confidence}] ${prefix}：${content}`
                const lineTokens = await tokenizer(line + '\n')
                if (usedTokens + lineTokens > available) break

                lines.push(line)
                usedMemoryIds.push(memory.id)
                usedTokens += lineTokens
            }

            if (lines.length === 0) return []
            const content = header + lines.join('\n')
            const tokenLength = await tokenizer(content)
            Memories.db.mutate.markUsed(usedMemoryIds).catch(() => undefined)

            return [
                {
                    content,
                    source: CONTACT_MEMORY_NAME,
                    tokenLength,
                    position: {
                        type: 'relative',
                        location: 'afterSystem',
                    },
                },
            ]
        },
    }
}

const createAuthorNotesDataSource = async (): Promise<DataSource | undefined> => {
    const { id: chatId } = Chats.useChatState.getState()
    if (!chatId) return
    const chatData = await Chats.db.query.chatShallow(chatId)
    if (!chatData) return
    const characterId = chatData.character_id

    const activeNotes = await AuthorNotes.db.query.getActiveNotes(characterId, chatId)
    if (!activeNotes || activeNotes.length === 0) return

    const tokenTotal = activeNotes.reduce((a, b) => a + (b.token_length ?? 0), 0)
    const dataSourceResults: DataSourceResult[] = activeNotes.map((item) => ({
        content: replaceMacros(item.content),
        source: AUTHOR_NOTE_NAME,
        tokenLength: item.token_length ?? 0,
        position: {
            type: 'index',
            location: item.depth ?? 0,
        },
    }))

    return {
        name: AUTHOR_NOTE_NAME,
        priority: 1,
        tokenBudget: tokenTotal,
        retrieve: async (params) => {
            return dataSourceResults
        },
    }
}

export const getDataSources = async (): Promise<DataSource[]> => {
    let dataSources = [createExampleDataSource()]
    const contactMemorySource = await createContactMemoryDataSource()
    if (contactMemorySource) dataSources.push(contactMemorySource)
    const authorNotesSource = await createAuthorNotesDataSource()
    if (authorNotesSource) dataSources.push(authorNotesSource)

    const lorebooks = await createLorebookDataSource()
    if (lorebooks) {
        dataSources.push(...lorebooks)
    }

    return dataSources
}
