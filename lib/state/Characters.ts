import { extractPngTextChunk, replacePngTextChunk } from '@vali98/react-native-png-utils'
import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    isNull,
    like,
    notExists,
    notInArray,
    sql,
} from 'drizzle-orm'
import { Asset } from 'expo-asset'
import * as DocumentPicker from 'expo-document-picker'
import { Paths } from 'expo-file-system'
import { t } from 'i18next'
import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import Alert from '@components/views/Alert'
import { db as database } from '@db/db'
import {
    characterGreetings,
    characterTags,
    characters,
    chatEntries,
    chatSwipes,
    chats,
    tags,
} from '@db/schema'
import { authorNotes, characterLinks, characterLorebooks, chatAttachments } from '@db/schema'
import { Tokenizer } from '@lib/engine/Tokenizer'
import { Storage } from '@lib/enums/Storage'
import { getNetworkNow } from '@lib/utils/NetworkTime'
import { useWalletStore } from './Wallet'
import { useSocialStore } from './Social'
import {
    copyFile,
    deleteFile,
    fileExists,
    readBase64Async,
    readStringAsync,
    saveStringToDownload,
} from '@lib/utils/File'
import { replaceMacroBase } from '@lib/utils/Macros'

import { Logger } from './Logger'
import { useDeveloperContactStore } from './DeveloperContact'
import { useDeveloperModeStore } from './DeveloperMode'
import { createMMKVStorage } from '../storage/MMKV'

export type CharInfo = {
    name: string
    id: number
    image_id: number
    last_modified: number
    tags: string[]
    links: {
        id: number
        type: 'user_id' | 'instruct_id' | 'connection_index' | 'sampler_index' | 'model_id'
        character_id: number
        value: number
    }[]
    latestSwipe?: string
    latestName?: string
    latestChat?: number
    deletedAt?: number
}

export type CharacterTokenCache = {
    otherName: string
    description_length: number
    examples_length: number
    personality_length: number
    scenario_length: number
}

type CharacterCardState = {
    card?: CharacterCardData
    tokenCache: CharacterTokenCache | undefined
    id: number | undefined
    updateCard: (card: CharacterCardData) => void
    setCard: (id: number) => Promise<string | undefined>
    unloadCard: () => void
    getImage: () => string
    updateImage: (sourceURI: string) => void
    getCache: (otherName: string) => Promise<CharacterTokenCache>
}

export type CharacterCardData = Awaited<ReturnType<typeof Characters.db.query.cardQuery>>

export const MAX_CONTACTS = 5

const CHARACTER_CARD_TEXT_CHUNK_KEYWORDS = [
    'Description', // AI bot base description
    'Comment', // incorrect migration, needs to be retained
    'character_card',
    'chara',
    'ccv3',
]

const buildFarewellMessage = (
    card: Pick<NonNullable<CharacterCardData>, 'name' | 'personality' | 'description'>
) => {
    const profile = `${card.personality} ${card.description}`.toLowerCase()
    const name = card.name?.trim() || '我'
    let question = `你……是要把我删掉吗？`
    let plea = '别这样好不好，我求你，再给我一次机会。'
    let goodbye = '我很舍不得你，真的不能留下我吗？'

    if (/高冷|冷淡|傲娇|毒舌/.test(profile)) {
        question = `你就这么想让我消失？连一句解释都不给我？`
        plea = '……算我求你，别删。就这一次。'
        goodbye = '我嘴上不说，可我真的不想走。你舍得吗？'
    } else if (/内向|腼腆|害羞|慢热|社恐|沉默|寡言|清冷/.test(profile)) {
        question = `……你是要删掉我吗？`
        plea = '我不太会说话，可我真的不想走。'
        goodbye = '如果可以……能不能再留我一会儿？'
    } else if (/温柔|体贴|安静|成熟/.test(profile)) {
        question = `是我哪里做得不好吗？你要把我删掉？`
        plea = '求你别走，再陪我说一句话也好。'
        goodbye = '我会一直记得你。你真的舍得让我消失吗？'
    } else if (/活泼|开朗|热情|元气/.test(profile)) {
        question = `等等！你真的要把我删掉吗？我有哪里惹你不开心了？`
        plea = '不要嘛，我求你了，再给我一次机会好不好？'
        goodbye = '我一点都不想和你告别……留下来，好不好？'
    }

    return `${name}：${question}\n\n${name}：${plea}\n\n${name}：${goodbye}`
}

export namespace Characters {
    export const getFarewellMessage = buildFarewellMessage

    export const getFarewellLines = (card: Parameters<typeof buildFarewellMessage>[0]) =>
        buildFarewellMessage(card)
            .split('\n\n')
            .map((line) => {
                const separator = line.indexOf('：')
                return separator >= 0 ? line.slice(separator + 1) : line
            })

    export const useUserStore = create<CharacterCardState>()(
        persist(
            (set, get) => ({
                id: undefined,
                card: undefined,
                tokenCache: undefined,
                setCard: async (id: number) => {
                    const card = await db.query.card(id)
                    if (card) set({ card: card, id: id, tokenCache: undefined })
                    return card?.name
                },
                unloadCard: () => {
                    set({
                        id: undefined,
                        card: undefined,
                        tokenCache: undefined,
                    })
                },
                updateCard: (card: CharacterCardData) => {
                    set({ card })
                },
                getImage: () => {
                    return getImageDir(get().card?.image_id ?? 0)
                },
                updateImage: async (sourceURI: string) => {
                    const id = get().id
                    const oldImageID = get().card?.image_id
                    const card = get().card
                    if (!id || !oldImageID || !card) {
                        Logger.errorToast(t('common.errors.couldNotGetData'))
                        return
                    }
                    const imageID = getNetworkNow()
                    await db.mutate.updateCardField('image_id', imageID, id)
                    await deleteImage(oldImageID)
                    await copyImage(sourceURI, imageID)
                    card.image_id = imageID
                    set({ card })
                },
                getCache: async (userName: string) => {
                    const cache = get().tokenCache
                    if (cache && cache?.otherName === userName) return cache

                    const card = get().card
                    if (!card)
                        return {
                            otherName: userName,
                            description_length: 0,
                            examples_length: 0,
                            personality_length: 0,
                            scenario_length: 0,
                        }
                    const description = replaceMacros(card.description)
                    const examples = replaceMacros(card.mes_example)
                    const personality = replaceMacros(card.personality)
                    const scenario = replaceMacros(card.scenario)

                    const getTokenCount = Tokenizer.getTokenizer()

                    const newCache: CharacterTokenCache = {
                        otherName: userName,
                        description_length: await getTokenCount(description),
                        examples_length: await getTokenCount(examples),
                        personality_length: await getTokenCount(personality),
                        scenario_length: await getTokenCount(scenario),
                    }

                    set({ tokenCache: newCache })
                    return newCache
                },
            }),
            {
                name: Storage.UserCard,
                storage: createMMKVStorage(),
                version: 2,
                partialize: (state) => ({ id: state.id, card: state.card }),
                migrate: async (persistedState: any, version) => {
                    if (version === 1) {
                        // migration from CharacterCardV2 to CharacterCardData
                        Logger.info('Migrating User Store to v2')
                        persistedState.id = undefined
                        persistedState.card = undefined
                    }
                    return persistedState
                },
            }
        )
    )

    export const useCharacterStore = create<CharacterCardState>()((set, get) => ({
        id: undefined,
        card: undefined,
        tokenCache: undefined,
        setCard: async (id: number) => {
            const card = await db.query.card(id)
            set({ card: card, id: id, tokenCache: undefined })
            return card?.name
        },
        updateCard: (card: CharacterCardData) => {
            set({ card })
        },
        unloadCard: () => {
            set({
                id: undefined,
                card: undefined,
                tokenCache: undefined,
            })
        },
        getImage: () => {
            return getImageDir(get().card?.image_id ?? 0)
        },
        updateImage: async (sourceURI: string) => {
            const id = get().id
            const oldImageID = get().card?.image_id
            const card = get().card
            if (!id || !oldImageID || !card) {
                Logger.errorToast(t('common.errors.couldNotGetData'))
                return
            }
            const imageID = getNetworkNow()
            await db.mutate.updateCardField('image_id', imageID, id)
            await deleteImage(oldImageID)
            await copyImage(sourceURI, imageID)
            card.image_id = imageID
            set({ card })
        },
        getCache: async (charName: string) => {
            const cache = get().tokenCache
            const card = get().card
            if (cache?.otherName && cache.otherName === useUserStore.getState().card?.name)
                return cache

            if (!card)
                return {
                    otherName: charName,
                    description_length: 0,
                    examples_length: 0,
                    personality_length: 0,
                    scenario_length: 0,
                }
            const description = replaceMacros(card.description)
            const examples = replaceMacros(card.mes_example)
            const personality = replaceMacros(card.personality)
            const scenario = replaceMacros(card.scenario)

            const getTokenCount = Tokenizer.getTokenizer()

            const newCache = {
                otherName: charName,
                description_length: await getTokenCount(description),
                examples_length: await getTokenCount(examples),
                personality_length: await getTokenCount(personality),
                scenario_length: await getTokenCount(scenario),
            }
            set({ tokenCache: newCache })
            return newCache
        },
    }))

    export namespace db {
        export namespace query {
            export const cardQuery = (charId: number) => {
                return database.query.characters.findFirst({
                    where: eq(characters.id, charId),
                    with: {
                        tags: {
                            columns: {
                                character_id: false,
                            },
                            with: {
                                tag: true,
                            },
                        },
                        alternate_greetings: true,
                        links: true,
                    },
                })
            }

            export const card = async (charId: number): Promise<CharacterCardData | undefined> => {
                const data = await cardQuery(charId)
                return data
            }

            export const cardList = async (
                type: 'character' | 'user',
                orderBy: 'id' | 'modified' = 'id'
            ) => {
                const query = await database.query.characters.findMany({
                    columns: {
                        id: true,
                        name: true,
                        image_id: true,
                        last_modified: true,
                        deleted_at: true,
                    },
                    with: {
                        tags: {
                            columns: {
                                character_id: false,
                            },
                            with: {
                                tag: true,
                            },
                        },
                        chats: {
                            columns: {
                                id: true,
                            },
                            limit: 1,
                            orderBy: desc(chats.last_modified),
                            with: {
                                messages: {
                                    columns: {
                                        id: true,
                                        name: true,
                                    },
                                    limit: 1,
                                    orderBy: desc(chatEntries.id),
                                    with: {
                                        swipes: {
                                            columns: {
                                                swipe: true,
                                            },
                                            orderBy: desc(chatSwipes.id),
                                            limit: 1,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    where: (characters, { eq }) => eq(characters.type, type),
                    orderBy: orderBy === 'id' ? characters.id : desc(characters.last_modified),
                })

                return query.map((item) => ({
                    ...item,
                    latestChat: item.chats[0]?.id,
                    latestSwipe: item.chats[0]?.messages[0]?.swipes[0]?.swipe,
                    latestName: item.chats[0]?.messages[0]?.name,
                    last_modified: item.last_modified ?? 0,
                    deletedAt: item.deleted_at ?? undefined,
                    tags: item.tags.map((item) => item.tag.tag),
                }))
            }

            export const cardListQuery = (
                type: 'character' | 'user',
                orderBy: 'id' | 'modified' = 'id'
            ) => {
                return database.query.characters.findMany({
                    columns: {
                        id: true,
                        name: true,
                        image_id: true,
                        last_modified: true,
                        deleted_at: true,
                    },
                    with: {
                        tags: {
                            columns: {
                                character_id: false,
                            },
                            with: {
                                tag: true,
                            },
                        },
                        chats: {
                            columns: {
                                id: true,
                            },
                            limit: 1,
                            orderBy: desc(chats.last_modified),
                            with: {
                                messages: {
                                    columns: {
                                        id: true,
                                        name: true,
                                    },
                                    limit: 1,
                                    orderBy: desc(chatEntries.id),
                                    with: {
                                        swipes: {
                                            columns: {
                                                swipe: true,
                                            },
                                            orderBy: desc(chatSwipes.id),
                                            limit: 1,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    where: (characters, { eq }) => eq(characters.type, type),
                    orderBy: orderBy === 'id' ? characters.id : desc(characters.last_modified),
                })
            }

            export const cardListQueryWindow = (
                type: 'character' | 'user',
                orderBy: 'name' | 'modified' = 'modified',
                direction: 'desc' | 'asc' = 'desc',
                limit = 20,
                offset = 0,
                searchFilter: string = '',
                searchTags: string[] = [],
                hiddenTags: string[] = []
            ) => {
                const dir = direction === 'asc' ? asc : desc
                return database.query.characters.findMany({
                    columns: {
                        id: true,
                        name: true,
                        image_id: true,
                        last_modified: true,
                        deleted_at: true,
                    },
                    where: (characters) => {
                        const base = eq(characters.type, type)
                        const search = searchFilter
                            ? like(characters.name, `%${searchFilter.trim().toLocaleLowerCase()}%`)
                            : undefined
                        const hidden =
                            hiddenTags.length > 0
                                ? notExists(
                                      database
                                          .select()
                                          .from(characterTags)
                                          .innerJoin(tags, eq(characterTags.tag_id, tags.id))
                                          .where(
                                              and(
                                                  eq(characterTags.character_id, characters.id),
                                                  inArray(tags.tag, hiddenTags)
                                              )
                                          )
                                  )
                                : undefined
                        const filteredTags =
                            searchTags.length > 0
                                ? gte(
                                      database
                                          .select({ count: sql<number>`count(*)` })
                                          .from(characterTags)
                                          .innerJoin(tags, eq(characterTags.tag_id, tags.id))
                                          .where(
                                              and(
                                                  eq(characterTags.character_id, characters.id),
                                                  inArray(tags.tag, searchTags)
                                              )
                                          ),
                                      searchTags.length
                                  )
                                : undefined

                        return and(base, search, hidden, filteredTags)
                    },
                    with: {
                        tags: {
                            columns: {},
                            with: {
                                tag: true,
                            },
                        },
                        chats: {
                            columns: {
                                id: true,
                            },
                            limit: 1,
                            orderBy: desc(chats.last_modified),
                            with: {
                                messages: {
                                    columns: {
                                        id: true,
                                        name: true,
                                    },
                                    limit: 1,
                                    orderBy: desc(chatEntries.id),
                                    with: {
                                        swipes: {
                                            columns: {
                                                swipe: true,
                                            },
                                            orderBy: desc(chatSwipes.id),
                                            limit: 1,
                                        },
                                    },
                                },
                            },
                        },
                        links: true,
                    },
                    orderBy:
                        orderBy === 'name' ? dir(characters.name) : dir(characters.last_modified),
                    limit: limit,
                    offset: offset,
                })
            }

            export const cardExists = async (charId: number) => {
                return await database.query.characters.findFirst({
                    where: eq(characters.id, charId),
                })
            }

            export const backgroundImageQuery = (charId: number) => {
                return database.query.characters.findFirst({
                    where: eq(characters.id, charId),
                    columns: { background_image: true },
                })
            }
        }

        export namespace mutate {
            const canCreateContact = async () => {
                if (useDeveloperModeStore.getState().enabled) return true
                const [{ total }] = await database
                    .select({ total: sql<number>`count(*)` })
                    .from(characters)
                    .where(and(eq(characters.type, 'character'), isNull(characters.deleted_at)))

                if (Number(total) >= MAX_CONTACTS) {
                    const developer = useDeveloperContactStore.getState()
                    if (developer.status === 'none' || developer.status === 'prompted') {
                        developer.request()
                        Alert.alert({
                            title: '开发者联系人申请好友',
                            description: '开发者：加个好友吧？',
                            buttons: [
                                {
                                    label: '拒绝',
                                    onPress: () => useDeveloperContactStore.getState().reject(),
                                },
                                {
                                    label: '同意',
                                    onPress: () => useDeveloperContactStore.getState().accept(),
                                },
                            ],
                            onDismiss: () => useDeveloperContactStore.getState().reject(),
                        })
                    } else {
                        Logger.errorToast(
                            `最多只能保留 ${MAX_CONTACTS} 位联系人，删除一位后可再加。`
                        )
                    }
                    return false
                }
                return true
            }

            export const createCard = async (
                name: string,
                type: 'user' | 'character' = 'character'
            ) => {
                if (type === 'character' && !(await canCreateContact())) return -1

                const { data } = createBlankV2Card(name)

                const [{ id }] = await database
                    .insert(characters)
                    .values({ ...data, type: type })
                    .returning({ id: characters.id })
                return id
            }

            export const updateCard = async (card: CharacterCardData, cardID: number) => {
                if (!card) return

                try {
                    const existing = await database.query.characters.findFirst({
                        columns: {
                            type: true,
                            persona_locked: true,
                            description: true,
                            personality: true,
                            scenario: true,
                            first_mes: true,
                            mes_example: true,
                        },
                        where: eq(characters.id, cardID),
                    })
                    if (!existing) return

                    const hasPersonaContent = [
                        existing.description,
                        existing.personality,
                        existing.scenario,
                        existing.first_mes,
                        existing.mes_example,
                    ].some((value) => !!value?.trim())
                    const personaLocked =
                        existing.type === 'character' &&
                        existing.persona_locked &&
                        hasPersonaContent &&
                        !useDeveloperModeStore.getState().enabled

                    await database
                        .update(characters)
                        .set({
                            name: card.name,
                            ...(personaLocked
                                ? {}
                                : {
                                      description: card.description,
                                      first_mes: card.first_mes,
                                      personality: card.personality,
                                      scenario: card.scenario,
                                      mes_example: card.mes_example,
                                      persona_locked: existing.type === 'character',
                                  }),
                        })
                        .where(eq(characters.id, cardID))
                    if (personaLocked) return
                    await Promise.all(
                        card.alternate_greetings.map(async (item) => {
                            await database
                                .update(characterGreetings)
                                .set({ greeting: item.greeting })
                                .where(eq(characterGreetings.id, item.id))
                        })
                    )
                    if (card.tags) {
                        // create { tag: string }[]
                        const newTags = card.tags
                            .filter((item) => item.tag_id === -1)
                            .map((tag) => ({ tag: tag.tag.tag }))

                        // New tags are marked with -1
                        const currentTagIDs = card.tags
                            .filter((item) => item.tag_id !== -1)
                            .map((item) => ({
                                character_id: card.id,
                                tag_id: item.tag.id,
                            }))
                        const newTagIDs: (typeof characterTags.$inferSelect)[] = []

                        // optimistically add missing tags
                        if (newTags.length !== 0) {
                            await database
                                .insert(tags)
                                .values(newTags)
                                .onConflictDoNothing()
                                .returning({
                                    id: tags.id,
                                })
                                // concat new tags to tagids
                                .then((result) => {
                                    newTagIDs.push(
                                        ...result.map((item) => ({
                                            character_id: card.id,
                                            tag_id: item.id,
                                        }))
                                    )
                                })
                        }
                        const mergedTags = [...currentTagIDs, ...newTagIDs]
                        if (mergedTags.length !== 0)
                            await database
                                .insert(characterTags)
                                .values(mergedTags)
                                .onConflictDoNothing()

                        const ids = mergedTags.map((item) => item.tag_id)
                        // delete orphaned characterTags

                        await database
                            .delete(characterTags)
                            .where(
                                and(
                                    notInArray(characterTags.tag_id, ids),
                                    eq(characterTags.character_id, card.id)
                                )
                            )

                        // delete orphaned tags
                        await database
                            .delete(tags)
                            .where(
                                notInArray(
                                    tags.id,
                                    database
                                        .select({ tag_id: characterTags.tag_id })
                                        .from(characterTags)
                                )
                            )
                    }
                } catch (e) {
                    Logger.warn(`${e}`)
                }
            }

            export const addAltGreeting = async (charId: number) => {
                const card = await database.query.characters.findFirst({
                    columns: { persona_locked: true },
                    where: eq(characters.id, charId),
                })
                if (card?.persona_locked && !useDeveloperModeStore.getState().enabled) return -1

                const [{ id }] = await database
                    .insert(characterGreetings)
                    .values({
                        character_id: charId,
                        greeting: '',
                    })
                    .returning({ id: characterGreetings.id })
                return id
            }

            export const deleteAltGreeting = async (altGreetingId: number) => {
                await database
                    .delete(characterGreetings)
                    .where(eq(characterGreetings.id, altGreetingId))
            }

            // TODO: Proper per field updates, though not that expensive
            export const updateCardField = async (
                field: keyof NonNullable<CharacterCardData>,
                data: any,
                charId: number
            ) => {
                if (field === 'alternate_greetings') {
                    // find greetings and update
                    Logger.warn('ALT GREETINGS MODIFICATION NOT IMPLEMENTED')
                    return
                }
                await database
                    .update(characters)
                    .set({ [field]: data })
                    .where(eq(characters.id, charId))
            }

            const removeCharacterData = async (
                charID: number,
                options?: { keepChats?: boolean }
            ) => {
                const data = await database.query.characters.findFirst({
                    where: eq(characters.id, charID),
                    columns: { image_id: true, background_image: true, type: true },
                })
                if (!data) return undefined

                if (!options?.keepChats) {
                    const attachments = await database
                        .select({ uri: chatAttachments.uri })
                        .from(chatAttachments)
                        .innerJoin(chatEntries, eq(chatAttachments.chat_entry_id, chatEntries.id))
                        .innerJoin(chats, eq(chatEntries.chat_id, chats.id))
                        .where(eq(chats.character_id, charID))
                    await Promise.all(attachments.map(async (item) => deleteFile(item.uri)))
                }
                if (data.background_image) await deleteImage(data.background_image)

                await database.transaction(async (tx) => {
                    if (!options?.keepChats) {
                        await tx.delete(chats).where(eq(chats.character_id, charID))
                    }
                    await tx.delete(authorNotes).where(eq(authorNotes.character_id, charID))
                    await tx
                        .delete(characterLorebooks)
                        .where(eq(characterLorebooks.character_id, charID))
                    await tx.delete(characterLinks).where(eq(characterLinks.character_id, charID))
                    await tx
                        .delete(characterGreetings)
                        .where(eq(characterGreetings.character_id, charID))
                    await tx.delete(characterTags).where(eq(characterTags.character_id, charID))
                })
                await database
                    .delete(tags)
                    .where(
                        notInArray(
                            tags.id,
                            database.select({ tag_id: characterTags.tag_id }).from(characterTags)
                        )
                    )
                useWalletStore.getState().deleteCharacter(charID)
                if (data.type === 'character') useSocialStore.getState().removeCharacter(charID)
                return data
            }

            export const deleteCard = async (charID: number) => {
                const data = await database.query.characters.findFirst({
                    where: eq(characters.id, charID),
                    columns: { image_id: true, background_image: true, type: true },
                })
                if (!data) return

                if (data.type !== 'character') {
                    try {
                        await removeCharacterData(charID, { keepChats: true })
                    } catch (error) {
                        Logger.warn(`Failed to clean user data: ${error}`)
                    }
                    if (data.image_id && data.image_id > 0) {
                        await deleteImage(data.image_id).catch((error) =>
                            Logger.warn(`Failed to delete user image: ${error}`)
                        )
                    }
                    await database.delete(characters).where(eq(characters.id, charID))
                    return
                }

                // Mark the row deleted first so cleanup failures cannot keep the contact limit full.
                const deletedAt = getNetworkNow()
                await database
                    .update(characters)
                    .set({
                        deleted_at: deletedAt,
                        last_modified: deletedAt,
                        description: '',
                        first_mes: '',
                        mes_example: '',
                        creator_notes: '',
                        system_prompt: '',
                        scenario: '',
                        personality: '',
                        post_history_instructions: '',
                        creator: '',
                        character_version: '',
                    })
                    .where(eq(characters.id, charID))

                try {
                    await removeCharacterData(charID, { keepChats: true })
                } catch (error) {
                    Logger.warn(`Failed to clean deleted contact data: ${error}`)
                }

                await database
                    .update(characters)
                    .set({ background_image: null })
                    .where(eq(characters.id, charID))
            }

            export const purgeCard = async (charID: number) => {
                const data = await removeCharacterData(charID)
                if (!data) return
                if (data.image_id && data.image_id > 0) await deleteImage(data.image_id)
                await database.delete(characters).where(eq(characters.id, charID))
            }

            export const updateModified = async (charID: number) => {
                await database
                    .update(characters)
                    .set({ last_modified: getNetworkNow() })
                    .where(eq(characters.id, charID))
            }

            export const createCharacter = async (card: CharacterCardV2, imageuri: string = '') => {
                if (!(await canCreateContact())) return false

                const { data } = card
                const image_id = await database.transaction(async (tx) => {
                    try {
                        const [{ id, image_id }] = await tx
                            .insert(characters)
                            .values({
                                type: 'character',
                                ...data,
                                persona_locked: true,
                            })
                            .returning({ id: characters.id, image_id: characters.image_id })

                        const greetingdata =
                            typeof data?.alternate_greetings === 'object'
                                ? (data?.alternate_greetings?.map((item) => ({
                                      character_id: id,
                                      greeting: item,
                                  })) ?? [])
                                : []
                        if (greetingdata.length > 0)
                            for (const greeting of greetingdata)
                                await tx.insert(characterGreetings).values(greeting)

                        if (data.tags && data?.tags?.length !== 0) {
                            const tagsdata = data.tags.map((tag) => ({ tag: tag }))
                            for (const tag of tagsdata)
                                await tx.insert(tags).values(tag).onConflictDoNothing()

                            const tagids = (
                                await tx.query.tags.findMany({
                                    where: inArray(tags.tag, data.tags),
                                })
                            ).map((item) => ({
                                character_id: id,
                                tag_id: item.id,
                            }))
                            await tx.insert(characterTags).values(tagids).onConflictDoNothing()
                        }
                        return image_id
                    } catch (error) {
                        Logger.errorToast(
                            t('common.errors.rollingBackDueToError'),
                            JSON.stringify(error)
                        )
                        tx.rollback()
                        return undefined
                    }
                })
                if (!image_id || image_id < 0) return false
                if (imageuri) await copyImage(imageuri, image_id)
                return true
            }

            export const duplicateCard = async (charId: number) => {
                const card = await db.query.card(charId)

                if (!card) {
                    Logger.errorToast(t('character.editor.errors.copyCardNotExist'))
                    return false
                }
                const imageDir = getImageDir(card.image_id)
                const imageCacheDir = `${Paths.cache.uri}${card.image_id}`
                let cacheLoc = ''

                if (fileExists(imageDir)) {
                    const copied = await copyFile({
                        from: imageDir,
                        to: imageCacheDir,
                    })
                    if (!copied) return false
                    cacheLoc = imageCacheDir
                }

                const now = getNetworkNow()
                card.last_modified = now
                card.image_id = now
                if (card.background_image) {
                    const backgroundId = getNetworkNow()
                    const copied = await copyFile({
                        from: getImageDir(card.background_image),
                        to: getImageDir(backgroundId),
                    })
                    if (!copied) return false
                    card.background_image = backgroundId
                }
                const cv2 = convertDBDataToCV2(card)
                if (!cv2) {
                    Logger.errorToast(t('character.editor.errors.failedToCopyCard'))
                    return false
                }
                try {
                    const created = await createCharacter(cv2, cacheLoc)
                    if (!created) return false
                    Logger.info(`Card cloned: ${card.name}`)
                    return true
                } catch (e) {
                    Logger.info(`Failed to clone card: ${e}`)
                    return false
                }
            }

            export const updateBackground = async (charId: number, imageURI: number) => {
                await database
                    .update(characters)
                    .set({ background_image: imageURI })
                    .where(eq(characters.id, charId))
            }

            export const deleteBackground = async (charId: number) => {
                await database
                    .update(characters)
                    .set({ background_image: null })
                    .where(eq(characters.id, charId))
            }

            export const deleteImage = async (charId: number) => {
                await database
                    .update(characters)
                    .set({ image_id: -1 })
                    .where(eq(characters.id, charId))
            }
        }

        export namespace live {
            export const listSimple = (type: 'character' | 'user') => {
                return database.query.characters.findMany({
                    columns: {
                        id: true,
                        name: true,
                        image_id: true,
                        last_modified: true,
                    },
                    where: (characters, { eq }) => eq(characters.type, type),
                    orderBy: characters.id,
                })
            }
        }
    }

    export const importBackground = async (charId: number, oldBackground?: number | null) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: ['image/*', 'application/json'],
            })
            if (result.canceled) return
            const dir = result.assets[0].uri
            if (!dir) return
            const imageId = getNetworkNow()
            if (oldBackground) {
                await deleteImage(oldBackground)
            }
            await copyImage(dir, imageId)
            await db.mutate.updateBackground(charId, imageId)
        } catch (e) {
            Logger.error(`Failed to import background`)
            Logger.error(`Error: ` + e)
        }
    }

    export const deleteBackground = async (charId: number, imageId: number) => {
        try {
            await db.mutate.deleteBackground(charId)
            await deleteImage(imageId)
            Logger.info(`Deleted image with id: ` + imageId)
        } catch (e) {
            Logger.errorToast(t('character.editor.errors.deleteBackground'))
            Logger.error(`Error: ` + e)
        }
    }

    export const deleteImage = async (imageID: number) => {
        await deleteFile(getImageDir(imageID))
    }

    export const copyImage = async (uri: string, imageID: number) => {
        const copied = await copyFile({
            from: uri,
            to: getImageDir(imageID),
        })
        if (!copied) throw new Error('Character image could not be copied')
    }

    export const convertDBDataToCV2 = (data: NonNullable<CharacterCardData>): CharacterCardV2 => {
        const { id, ...rest } = data
        return {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                ...rest,
                tags: rest.tags.map((item) => item.tag.tag),
                alternate_greetings: rest.alternate_greetings.map((item) => item.greeting),
            },
        }
    }

    export const createCharacterFromImage = async (uri: string) => {
        try {
            const file = await readBase64Async(uri)
            if (!file) {
                Logger.errorToast(t('character.editor.errors.createFromImage'))
                return
            }
            const [result] = extractPngTextChunk(file, {
                keywords: CHARACTER_CARD_TEXT_CHUNK_KEYWORDS,
            })

            if (!result) {
                Logger.errorToast(t('character.editor.errors.createFromImage'))
                return
            }

            const card = JSON.parse(result.data)
            if (card === undefined) {
                Logger.errorToast(t('character.editor.errors.cardNoCharacter'))
                return
            }

            return await createCharacterFromV2JSON(card, uri)
        } catch (e) {
            Logger.errorToast(t('character.editor.errors.createFailed'))
            Logger.error(`${e}`)
        }
    }

    const createCharacterFromV1JSON = async (data: any, uri: string | undefined = undefined) => {
        const result = characterCardV1Schema.safeParse(data)
        if (result.error) {
            Logger.errorToast(t('character.editor.errors.invalidCharacterCard'))
            return
        }
        const converted = createBlankV2Card(result.data.name, result.data)

        Logger.info(`Creating new character: ${result.data.name}`)
        return db.mutate.createCharacter(converted, uri)
    }

    const createCharacterFromV2JSON = async (data: any, uri: string | undefined = undefined) => {
        // check JSON def
        const result = characterCardV2Schema.safeParse(data)
        if (result.error) {
            Logger.warnToast(t('character.editor.errors.v2ParsingFailedFallingBack'))
            return await createCharacterFromV1JSON(data, uri)
        }

        Logger.info(`Creating new character: ${result.data.data.name}`)
        return await db.mutate.createCharacter(result.data, uri)
    }

    export const importCharacter = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            type: ['image/*', 'application/json'],
            multiple: true,
        })
        if (result.canceled) return
        result.assets.map(async (item) => {
            const isPNG = item.mimeType?.includes('image/')
            const isJSON = item.mimeType?.includes('application/json')
            try {
                if (isJSON) {
                    const data = await readStringAsync(item.uri)
                    await createCharacterFromV2JSON(JSON.parse(data))
                }

                if (isPNG) await createCharacterFromImage(item.uri)
            } catch (e) {
                Logger.error(`Failed to create card from '${item.name}': ${e}`)
            }
        })
    }

    export const exportCharacter = async (id: number) => {
        const dbcard = await db.query.card(id)
        if (!dbcard) {
            Logger.error('Exported card does not exist!')
            return
        }
        // name can be empty string, should at least have something
        const exportedFileName = dbcard.name ?? 'Character'
        const cardString = JSON.stringify(convertDBDataToCV2(dbcard))

        const imagePath = getImageDir(dbcard.image_id)
        if (fileExists(imagePath)) {
            const fileData = await readBase64Async(imagePath)
            if (!fileData) return
            const exportData = replacePngTextChunk(
                fileData,
                [{ data: cardString, keyword: 'chara', b64encode: true }],
                { removeKeywords: CHARACTER_CARD_TEXT_CHUNK_KEYWORDS }
            )
            await saveStringToDownload(exportData, exportedFileName + '.png', 'base64')
        } else {
            await saveStringToDownload(cardString, exportedFileName + '.json', 'utf8')
        }
    }

    export const getImageDir = (imageId: number) => {
        return `${Paths.document.uri}characters/${imageId}.png`
    }

    export const createDefaultCard = async () => {
        const filename = 'aibot'
        const pngName = filename + '.png'
        const cardDefaultDir = `${Paths.document.uri}appAssets/${pngName}`

        try {
            if (!fileExists(cardDefaultDir)) {
                Logger.info('Importing default card.')
                const [asset] = await Asset.loadAsync(require('./../../assets/models/aibot.raw'))
                if (
                    !asset.localUri ||
                    !(await copyFile({ from: asset.localUri, to: cardDefaultDir }))
                )
                    throw new Error('Default character asset could not be copied')
            }
            return Boolean(await createCharacterFromImage(cardDefaultDir))
        } catch (e) {
            Logger.errorToast(t('settings.character.errors.failedToCreateDefaultCharacter'))
            Logger.error('Error: ' + e)
            return false
        }
    }
}

const characterCardV1Schema = z.object({
    name: z.string(),
    description: z.string(),
    personality: z.string().catch(''),
    scenario: z.string().catch(''),
    first_mes: z.string().catch(''),
    mes_example: z.string().catch(''),
})

const characterCardV2DataSchema = z.object({
    name: z.string(),
    description: z.string().catch(''),
    personality: z.string().catch(''),
    scenario: z.string().catch(''),
    first_mes: z.string().catch(''),
    mes_example: z.string().catch(''),

    creator_notes: z.string().catch(''),
    system_prompt: z.string().catch(''),
    post_history_instructions: z.string().catch(''),
    creator: z.string().catch(''),
    character_version: z.string().catch(''),
    alternate_greetings: z.string().array().catch([]),
    tags: z.string().array().catch([]),
})

const characterCardV2Schema = z.object({
    spec: z.literal('chara_card_v2'),
    spec_version: z.literal('2.0'),
    data: characterCardV2DataSchema,
})

// placeholder types
// type CharaterCardV1 = z.infer<typeof characterCardV1Schema>
// type CharacterCardV2Data = z.infer<typeof characterCardV2DataSchema>

type CharacterCardV2 = z.infer<typeof characterCardV2Schema>

const createBlankV2Card = (
    name: string,
    options: {
        description: string
        personality: string
        scenario: string
        first_mes: string
        mes_example: string
    } = { description: '', personality: '', scenario: '', first_mes: '', mes_example: '' }
): CharacterCardV2 => {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name: name,
            description: options.description,
            personality: options.personality,
            scenario: options.scenario,
            first_mes: options.first_mes,
            mes_example: options.mes_example,

            // New fields start here
            creator_notes: '',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: [],

            // May 8th additions
            tags: [],
            creator: '',
            character_version: '',
        },
    }
}

type Macro = {
    macro: string
    value: string
}

export const replaceMacros = (text: string) => {
    if (text === undefined) return ''
    let newText: string = text
    const charName = Characters.useCharacterStore.getState().card?.name ?? ''
    const userName = Characters.useUserStore.getState().card?.name ?? ''
    const rules: Macro[] = [
        { macro: '{{user}}', value: userName },
        { macro: '{{char}}', value: charName },
    ]
    newText = replaceMacroBase(newText, { extraMacros: rules })
    return newText
}
