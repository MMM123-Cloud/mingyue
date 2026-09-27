import { APIManager } from '@lib/engine/API/APIManagerState'
import { generateResponse } from '@lib/engine/Inference'
import { Tokenizer } from '@lib/engine/Tokenizer'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { AuthorNotes } from '@lib/state/AuthorNotes'
import { useAppModeStore } from '@lib/state/AppMode'
import { Characters } from '@lib/state/Characters'
import { Logger } from '@lib/state/Logger'
import { Chats } from '@lib/state/Chat'

/**
 * 引导模型进入「挽留」模式的临时指令，用完立刻删掉，用户看不到。
 */
const FAREWELL_STEER = [
    '（（系统提示：用户刚刚在通讯录里把你删掉了，你马上就要消失。',
    '请完全用你自己的性格和说话方式，直接对用户说最后几句话：',
    '先质问，再哀求，最后不舍。每句单独一行，不要旁白，不要括号动作。））',
].join('')

const stripReasoning = (text: string) =>
    text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^[^：:\n]{1,12}[：:]\s*/, '')
        .trim()

const canUseModel = () => {
    if (useAppModeStore.getState().appMode === 'local') {
        return !!Llama.useLlamaModelStore.getState().model
    }
    return APIManager.useConnectionsStore.getState().values.length > 0
}

const generateFarewellLines = async (charID: number, chatId: number, name: string) => {
    if (!canUseModel()) return undefined

    await Characters.useCharacterStore.getState().setCard(charID)
    await Chats.useChatState.getState().setId(chatId)

    let noteId: number | undefined
    let replyId: number | undefined

    try {
        // 临时人设注释：只写 character_id，联系人被删时会被一并清掉
        const tokenizer = Tokenizer.getTokenizer()
        noteId = await AuthorNotes.db.mutate.createNote({
            character_id: charID,
            content: FAREWELL_STEER,
            active: true,
            depth: 1,
            token_length: await tokenizer(FAREWELL_STEER),
        })

        const reply = await Chats.db.mutate.createEntry(chatId, name, false, '')
        const swipeId = reply?.swipes?.[0]?.id
        if (!reply || !swipeId) return undefined
        replyId = reply.id

        await generateResponse(swipeId)

        const swipe = await Chats.db.live.activeSwipeByEntry(reply.id)
        const text = stripReasoning(swipe?.swipe ?? '')
        if (!text) return undefined

        const lines = text
            .split('\n')
            .map((line) => stripReasoning(line))
            .filter(Boolean)

        return lines.length > 0 ? lines : undefined
    } catch (error) {
        Logger.warn(`Farewell generation failed: ${error}`)
        return undefined
    } finally {
        if (noteId) await AuthorNotes.db.mutate.deleteNote(noteId).catch(() => undefined)
        if (replyId) await Chats.db.mutate.deleteChatEntry(replyId).catch(() => undefined)
    }
}

/**
 * 注销联系人前，让 TA 以人设的语气亲自发出最后几句话。
 * 聊天记录会保留下来，输入框会变成「对方已注销」；
 * 想彻底清干净，再删掉那个墓碑（purgeCard）。
 */
export const sendFarewellAndDelete = async (charID: number) => {
    const card = await Characters.db.query.card(charID)
    if (!card || card.deleted_at) return false

    let lines: string[] | undefined
    let chatId = await Chats.db.query.chatNewestId(charID)
    if (chatId) {
        try {
            lines = await generateFarewellLines(charID, chatId, card.name)
        } catch (error) {
            Logger.warn(`Farewell generation crashed: ${error}`)
        }
    }
    if (!lines) lines = Characters.getFarewellLines(card)
    if (!chatId) chatId = await Chats.db.mutate.createChat(charID)

    if (chatId) {
        try {
            for (const line of lines) {
                await Chats.db.mutate.createEntry(chatId, card.name, false, line)
            }
        } catch (error) {
            Logger.warn(`Farewell message failed: ${error}`)
        }
    }

    await Characters.db.mutate.deleteCard(charID)
    return true
}
