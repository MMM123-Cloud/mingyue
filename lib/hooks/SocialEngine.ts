import { eq } from 'drizzle-orm'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { db as database } from '@db/db'
import { characters } from '@db/schema'
import { Chats } from '@lib/state/Chat'
import { Logger } from '@lib/state/Logger'
import { useRelationshipStore } from '@lib/state/Relationships'
import { getNetworkDate, getNetworkNow, syncNetworkTime } from '@lib/utils/NetworkTime'
import { SocialCharacterSeed, SocialPost, useSocialStore } from '@lib/state/Social'
import { mmkv } from '@lib/storage/MMKV'

const PROACTIVE_STATE_KEY = 'mingyue-proactive-message-state'
const GLOBAL_MESSAGE_GAP = 6 * 60 * 60 * 1000
const CHARACTER_MESSAGE_GAP = 20 * 60 * 60 * 1000
const RECENT_CHAT_GAP = 45 * 60 * 1000
const RECENT_POST_WINDOW = 30 * 60 * 1000

type ProactiveTimeSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'quiet'
type ProactivePersonaKind = 'reserved' | 'gentle' | 'energetic' | 'steady'

type ProactiveMessageState = {
    lastGlobalAt: number
    lastByCharacter: Record<string, number>
    sentPostIds: string[]
}

const hashString = (value: string) => {
    return value.split('').reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0)
}

const readProactiveState = (): ProactiveMessageState => {
    try {
        const stored = mmkv.getString(PROACTIVE_STATE_KEY)
        if (!stored) throw new Error('missing state')
        const parsed = JSON.parse(stored) as Partial<ProactiveMessageState>
        return {
            lastGlobalAt: parsed.lastGlobalAt ?? 0,
            lastByCharacter: parsed.lastByCharacter ?? {},
            sentPostIds: parsed.sentPostIds ?? [],
        }
    } catch {
        return { lastGlobalAt: 0, lastByCharacter: {}, sentPostIds: [] }
    }
}

const writeProactiveState = (state: ProactiveMessageState) => {
    mmkv.set(PROACTIVE_STATE_KEY, JSON.stringify(state))
}

const getTimeSlot = (now = getNetworkDate()): ProactiveTimeSlot => {
    const hour = now.getHours() + now.getMinutes() / 60
    if (hour < 7.5 || hour >= 23.5) return 'quiet'
    if (hour < 11.5) return 'morning'
    if (hour < 14) return 'midday'
    if (hour < 18) return 'afternoon'
    return 'evening'
}

const getPersonaKind = (character: SocialCharacterSeed): ProactivePersonaKind => {
    const profile = `${character.personality ?? ''} ${character.description ?? ''}`
    if (/内向|腼腆|害羞|慢热|社恐|沉默|寡言|安静|清冷|不善表达/.test(profile)) {
        return 'reserved'
    }
    if (/高冷|冷淡|傲娇|毒舌/.test(profile)) return 'reserved'
    if (/温柔|体贴|成熟|细腻|浪漫/.test(profile)) return 'gentle'
    if (/活泼|开朗|热情|元气|直率|话多/.test(profile)) return 'energetic'
    return 'steady'
}

const minimumIntimacyFor = (kind: ProactivePersonaKind, isPartner: boolean) => {
    const minimum = {
        reserved: 40,
        gentle: 22,
        energetic: 16,
        steady: 30,
    }[kind]
    return isPartner ? Math.max(0, minimum - 15) : minimum
}

const isTimeSuitableForPersona = (kind: ProactivePersonaKind, slot: ProactiveTimeSlot) => {
    if (slot === 'quiet') return false
    if (kind === 'reserved') return slot === 'afternoon' || slot === 'evening'
    if (kind === 'energetic') return slot !== 'evening'
    if (kind === 'gentle') return slot !== 'morning'
    return slot === 'midday' || slot === 'afternoon' || slot === 'evening'
}

const isContentSuitableForTime = (content: string, slot: ProactiveTimeSlot) => {
    if (slot === 'morning' && /晚安|半夜|夜深|今晚|睡不着/.test(content)) return false
    if (slot === 'midday' && /早安|晚安|半夜|夜深/.test(content)) return false
    if (slot === 'afternoon' && /早安|晚安|半夜|夜深/.test(content)) return false
    if (slot === 'evening' && /早安|早上好|上午好|起床/.test(content)) return false
    return true
}

const buildProactiveMessage = (
    post: SocialPost,
    personaKind: ProactivePersonaKind,
    now: number
) => {
    const content = post.content.trim()
    if (!post.location) return content

    const shouldShareLocation =
        personaKind !== 'energetic' && hashString(`${post.id}-${now}`) % 100 < 24
    if (!shouldShareLocation) return content

    return `${content}\n[位置] ${post.location.name} | ${post.location.latitude.toFixed(6)},${post.location.longitude.toFixed(6)}`
}

const sendProactiveMessage = async (posts: SocialPost[], characterSeeds: SocialCharacterSeed[]) => {
    if (posts.length === 0 || characterSeeds.length === 0) return

    const now = getNetworkNow()
    const state = readProactiveState()
    if (now - state.lastGlobalAt < GLOBAL_MESSAGE_GAP) return

    const timeSlot = getTimeSlot(getNetworkDate())
    if (timeSlot === 'quiet') return

    const relationships = useRelationshipStore.getState()
    const charactersById = new Map(characterSeeds.map((item) => [item.id, item]))
    const sentPostIds = new Set(state.sentPostIds)

    const candidates = [...posts]
        .filter((post) => post.author.type === 'character')
        .filter((post) => !sentPostIds.has(post.id))
        .filter((post) => now - post.createdAt <= RECENT_POST_WINDOW)
        .sort(
            (a, b) =>
                hashString(`${a.id}-${Math.floor(now / 3600000)}`) -
                hashString(`${b.id}-${Math.floor(now / 3600000)}`)
        )

    for (const post of candidates) {
        const character = charactersById.get(post.author.id)
        if (!character) continue

        const kind = getPersonaKind(character)
        if (!isTimeSuitableForPersona(kind, timeSlot)) continue
        if (!isContentSuitableForTime(post.content, timeSlot)) continue

        const isPartner = relationships.partnerCharacterId === character.id
        const intimacy = relationships.profiles[String(character.id)]?.intimacy ?? 0
        if (intimacy < minimumIntimacyFor(kind, isPartner)) continue

        const lastCharacterMessageAt = state.lastByCharacter[String(character.id)] ?? 0
        if (now - lastCharacterMessageAt < CHARACTER_MESSAGE_GAP) continue

        let chatId = await Chats.db.query.chatNewestId(character.id)
        if (!chatId) chatId = await Chats.db.mutate.createChat(character.id)
        if (!chatId) continue

        const latestSwipe = await Chats.db.query.chatLatestSwipe(chatId)
        if (latestSwipe?.send_date && now - latestSwipe.send_date.getTime() < RECENT_CHAT_GAP) {
            continue
        }

        const message = buildProactiveMessage(post, kind, now)
        if (!message) continue

        await Chats.db.mutate.createEntry(chatId, post.author.name, false, message)

        writeProactiveState({
            lastGlobalAt: now,
            lastByCharacter: {
                ...state.lastByCharacter,
                [String(character.id)]: now,
            },
            sentPostIds: [post.id, ...state.sentPostIds].slice(0, 120),
        })
        return
    }
}

export const useSocialEngine = () => {
    const syncCharacters = useSocialStore((state) => state.syncCharacters)
    const tick = useSocialStore((state) => state.tick)

    useEffect(() => {
        let mounted = true

        const run = async () => {
            try {
                await syncNetworkTime()
                const rows = await database.query.characters.findMany({
                    columns: {
                        id: true,
                        name: true,
                        image_id: true,
                        personality: true,
                        description: true,
                        deleted_at: true,
                    },
                    where: eq(characters.type, 'character'),
                })
                if (!mounted) return

                const seeds: SocialCharacterSeed[] = rows
                    .filter((item) => !item.deleted_at)
                    .map((item) => ({
                        id: item.id,
                        name: item.name,
                        imageId: item.image_id,
                        personality: item.personality,
                        description: item.description,
                    }))

                if (seeds.length === 0) return
                const seededPosts = syncCharacters(seeds)
                const generatedPosts = tick(seeds)
                await sendProactiveMessage([...generatedPosts, ...seededPosts], seeds)
            } catch (error) {
                Logger.warn(`Social life update failed: ${error}`)
            }
        }

        run()
        const interval = setInterval(run, 45000)
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') run()
        })

        return () => {
            mounted = false
            clearInterval(interval)
            subscription.remove()
        }
    }, [syncCharacters, tick])
}
