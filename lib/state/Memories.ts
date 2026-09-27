import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db as database } from '@db/db'
import { chatEntries, chats, chatSwipes, contactMemories } from '@db/schema'
import { getNetworkNow } from '@lib/utils/NetworkTime'
import { useRelationshipStore } from '@lib/state/Relationships'

export type ContactMemory = typeof contactMemories.$inferSelect

const IMPORTANT_MEMORY_PATTERN =
    /记住|别忘|不要忘|以后|将来|未来|答应|承诺|约定|计划|准备|生日|纪念日|地址|电话|账号|密码|秘密|喜欢|讨厌|害怕|梦想|愿望|见面|分手|结婚|家人|朋友|学校|工作|考试|生病|医院|难过|开心|重要|remember|promise|plan|birthday|address|secret|love|hate|meet|future|marry|family|school|work|exam|hospital|sad|happy|important|janji|ingat|rahasia|ulang tahun|alamat|rencana|masa depan|menikah|keluarga|sakit|помни|обещ|план|день рожд|адрес|секрет|люб|ненавид|встреч|будущ|семь|работ|школ|боле/i

const HIGH_IMPORTANCE_PATTERN =
    /一定|永远|绝不|发誓|求婚|结婚|离婚|怀孕|去世|自杀|伤害自己|报警|住院|手术|转账|借钱|欠款|救命|喜欢你|爱你|恨你|分手|绝交|秘密|承诺|约定|[0-9]{4}[年/-][0-9]{1,2}[月/-][0-9]{1,2}/i

const stripThinking = (content: string) => {
    return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

const getImportance = (content: string, speaker: 'user' | 'contact') => {
    let importance = 32

    if (IMPORTANT_MEMORY_PATTERN.test(content)) importance = 78
    if (HIGH_IMPORTANCE_PATTERN.test(content)) importance = 92
    if (/\[转账\]|\[位置\]|\[杞处\]|\[浣嶇疆\]/.test(content)) importance = 88
    if (content.length >= 160) importance += 6
    if (content.length >= 500) importance += 6
    if (speaker === 'user' && /我(?:想|要|喜欢|讨厌|准备|打算|决定|答应|承诺)/.test(content))
        importance += 8

    return Math.max(20, Math.min(100, importance))
}

const normalizeContent = (content: string) => stripThinking(content).slice(0, 4000)

const findEntryContext = async (entryId: number) => {
    const entry = await database.query.chatEntries.findFirst({
        where: eq(chatEntries.id, entryId),
        with: {
            swipes: {
                where: eq(chatSwipes.active, true),
                limit: 1,
            },
        },
    })
    if (!entry) return

    const chat = await database.query.chats.findFirst({
        where: eq(chats.id, entry.chat_id),
        columns: {
            character_id: true,
        },
    })
    if (!chat) return

    return { entry, characterId: chat.character_id }
}

export namespace Memories {
    export namespace db {
        export namespace mutate {
            export const captureEntry = async (entryId: number) => {
                const context = await findEntryContext(entryId)
                if (!context) return

                const { entry, characterId } = context
                const content = normalizeContent(entry.swipes[0]?.swipe ?? '')
                if (content.length < 2 || entry.recalled_at) return

                const existing = await database.query.contactMemories.findFirst({
                    where: eq(contactMemories.source_entry_id, entryId),
                    columns: { id: true },
                })
                if (existing) return existing.id

                const speaker = entry.is_user ? 'user' : 'contact'
                const importance = getImportance(content, speaker)
                const [memory] = await database
                    .insert(contactMemories)
                    .values({
                        character_id: characterId,
                        source_entry_id: entryId,
                        speaker,
                        content,
                        importance,
                        created_at: getNetworkNow(),
                    })
                    .returning({ id: contactMemories.id })

                useRelationshipStore
                    .getState()
                    .recordInteraction(characterId, importance, speaker, content)

                return memory?.id
            }

            export const captureSwipe = async (swipeId: number) => {
                const swipe = await database.query.chatSwipes.findFirst({
                    where: eq(chatSwipes.id, swipeId),
                    columns: {
                        entry_id: true,
                    },
                })
                if (!swipe) return
                return captureEntry(swipe.entry_id)
            }

            export const markUsed = async (memoryIds: number[]) => {
                if (memoryIds.length === 0) return
                await database
                    .update(contactMemories)
                    .set({
                        last_recalled_at: getNetworkNow(),
                        recall_count: sql`${contactMemories.recall_count} + 1`,
                    })
                    .where(inArray(contactMemories.id, memoryIds))
            }
        }

        export namespace query {
            export const list = (characterId: number) => {
                return database
                    .select()
                    .from(contactMemories)
                    .where(eq(contactMemories.character_id, characterId))
                    .orderBy(desc(contactMemories.created_at))
                    .limit(500)
            }

            export const forContext = async (characterId: number, limit = 60) => {
                const now = getNetworkNow()
                const rows = await database
                    .select()
                    .from(contactMemories)
                    .where(eq(contactMemories.character_id, characterId))
                    .orderBy(desc(contactMemories.importance), desc(contactMemories.created_at))
                    .limit(limit)

                return rows.filter((memory) => {
                    const ageDays = Math.max(0, (now - memory.created_at) / 86400000)
                    const hash = (memory.id * 2654435761 + characterId) >>> 0
                    const roll = hash % 100
                    if (memory.importance >= 80) return roll >= 4
                    if (memory.importance >= 55) return ageDays < 30 || roll >= 22
                    return ageDays < 10 || roll >= 48
                })
            }

            export const findForEntry = async (entryId: number) => {
                return await database.query.contactMemories.findFirst({
                    where: and(
                        eq(contactMemories.source_entry_id, entryId),
                        eq(contactMemories.speaker, 'user')
                    ),
                })
            }
        }
    }
}

export const scoreMemoryImportance = getImportance
