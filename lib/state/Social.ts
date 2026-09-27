import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getNetworkNow } from '@lib/utils/NetworkTime'
import { Storage } from '@lib/enums/Storage'
import { createMMKVStorage } from '@lib/storage/MMKV'

export type SocialActorType = 'user' | 'character'

export type SocialActor = {
    type: SocialActorType
    id: number
    name: string
    imageId?: number
}

export type SocialLocation = {
    name: string
    latitude: number
    longitude: number
}

export type SocialPostVisibility = 'public' | 'private' | 'selected'

export type SocialComment = {
    id: string
    actor: SocialActor
    content: string
    createdAt: number
}

export type SocialLike = {
    actor: SocialActor
    createdAt: number
}

export type SocialPost = {
    id: string
    author: SocialActor
    content: string
    location?: SocialLocation
    visibility?: SocialPostVisibility
    visibleTo?: number[]
    createdAt: number
    likes: SocialLike[]
    comments: SocialComment[]
}

export type LifeEvent = {
    id: string
    characterId: number
    characterName: string
    activity: string
    location: SocialLocation
    createdAt: number
}

export type CharacterLife = {
    characterId: number
    characterName: string
    imageId?: number
    personality: string
    description: string
    currentActivity: string
    location: SocialLocation
    lastUpdatedAt: number
    nextPostAt: number
    events: LifeEvent[]
    introducedTo: number[]
}

export type SocialRelation = {
    id: string
    aId: number
    bId: number
    introducedBy: string
    createdAt: number
}

export type SocialCharacterSeed = {
    id: number
    name: string
    imageId?: number
    personality?: string
    description?: string
}

type SocialState = {
    posts: SocialPost[]
    lives: Record<string, CharacterLife>
    relations: SocialRelation[]
    syncCharacters: (characters: SocialCharacterSeed[], seededAt?: number) => SocialPost[]
    tick: (characters: SocialCharacterSeed[]) => SocialPost[]
    publishPost: (
        author: SocialActor,
        content: string,
        location: SocialLocation | undefined,
        audience: SocialCharacterSeed[],
        options?: {
            visibility?: SocialPostVisibility
            visibleTo?: number[]
        }
    ) => string | undefined
    toggleLike: (postId: string, actor: SocialActor) => void
    addComment: (
        postId: string,
        actor: SocialActor,
        content: string,
        audience?: SocialCharacterSeed[]
    ) => void
    introduceByCard: (
        user: SocialActor,
        fromId: number,
        toId: number,
        characters: SocialCharacterSeed[],
        location?: SocialLocation
    ) => string
    removeCharacter: (characterId: number) => void
    clear: () => void
}

export const SOCIAL_LOCATIONS: SocialLocation[] = [
    { name: '广州·珠江新城', latitude: 23.1199, longitude: 113.3217 },
    { name: '广州·天河公园', latitude: 23.1264, longitude: 113.3658 },
    { name: '广州·北京路', latitude: 23.1257, longitude: 113.2702 },
    { name: '广州·永庆坊', latitude: 23.1136, longitude: 113.2444 },
    { name: '广州·白云山', latitude: 23.1835, longitude: 113.3027 },
    { name: '广州·琶醍', latitude: 23.1057, longitude: 113.3273 },
    { name: '广州·东山口', latitude: 23.1232, longitude: 113.2955 },
    { name: '广州·海珠湖', latitude: 23.0715, longitude: 113.3177 },
    { name: '广州·大学城', latitude: 23.0521, longitude: 113.3857 },
    { name: '广州·沙面', latitude: 23.1097, longitude: 113.2449 },
    { name: '广州·广州塔', latitude: 23.1091, longitude: 113.3245 },
    { name: '广州·荔湾湖', latitude: 23.1187, longitude: 113.2298 },
]

const activityPool = [
    '刚刚忙完，出来走一走。',
    '今天风挺舒服的，随手记一下。',
    '在一个安静的地方坐了一会儿。',
    '路边的花开了，拍给你看。',
    '突然有点想聊天，你们在做什么？',
    '路过这里，觉得这个时间很好。',
    '今天事情有点多，终于能喘口气了。',
    '这里比想象中舒服，待一会儿再走。',
]

const commentPool = [
    '下次带我也去。',
    '这个地方看起来不错。',
    '你今天心情好像很好。',
    '注意休息，别太累了。',
    '我也有点想去了。',
    '照片呢？我想看看。',
    '听起来今天挺充实。',
    '改天一起。',
]

const replyPool = [
    '好呀，等你有空。',
    '嗯，我也是这么想的。',
    '你也要照顾好自己。',
    '那就说定了。',
    '哈哈，确实。',
    '下次一起去。',
]

const stableRandom = (seed: number) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453
    return value - Math.floor(value)
}

const pick = <T>(items: T[], seed: number) => items[Math.floor(stableRandom(seed) * items.length)]

const makeId = (prefix: string, seed: number) => `${prefix}-${Math.floor(seed * 1000000)}`

const personaActivity = (character: SocialCharacterSeed, seed: number) => {
    const personality = `${character.personality ?? ''} ${character.description ?? ''}`
    if (/高冷|冷淡|傲娇|毒舌/.test(personality)) {
        return pick(['外面有点吵，这里还算安静。', '一个人待着也不错。', '只是路过。'], seed)
    }
    if (/温柔|体贴|安静|成熟/.test(personality)) {
        return pick(['坐在窗边看了一会儿天色。', '这里的阳光很舒服。', '慢一点，也挺好的。'], seed)
    }
    if (/活泼|开朗|热情|元气/.test(personality)) {
        return pick(['发现一个超好玩的地方！', '今天也太开心了吧！', '快来猜我在哪。'], seed)
    }
    return pick(activityPool, seed)
}

const personaComment = (character: SocialCharacterSeed, seed: number) => {
    const personality = `${character.personality ?? ''} ${character.description ?? ''}`
    if (/高冷|冷淡|傲娇|毒舌/.test(personality)) {
        return pick(['嗯。', '还行。', '你倒是挺会挑地方。'], seed)
    }
    if (/温柔|体贴|安静|成熟/.test(personality)) {
        return pick(['看起来很好，注意休息。', '谢谢分享。', '别太累。'], seed)
    }
    if (/活泼|开朗|热情|元气/.test(personality)) {
        return pick(['好想去！', '下次带上我！', '哇，这也太棒了。'], seed)
    }
    return pick(commentPool, seed)
}

const withLocationJitter = (location: SocialLocation, seed: number): SocialLocation => {
    return {
        ...location,
        latitude: location.latitude + (stableRandom(seed) - 0.5) * 0.01,
        longitude: location.longitude + (stableRandom(seed + 1) - 0.5) * 0.01,
    }
}

const makeActor = (character: SocialCharacterSeed): SocialActor => ({
    type: 'character',
    id: character.id,
    name: character.name,
    imageId: character.imageId,
})

const makeEvent = (character: SocialCharacterSeed, seed: number, createdAt: number): LifeEvent => {
    const location = withLocationJitter(pick(SOCIAL_LOCATIONS, seed + 17), seed)
    return {
        id: makeId('life', seed),
        characterId: character.id,
        characterName: character.name,
        activity: personaActivity(character, seed),
        location,
        createdAt,
    }
}

const seedInteractions = (
    post: SocialPost,
    audience: SocialCharacterSeed[],
    seed: number,
    introducedTo: number[] = []
): SocialPost => {
    const canViewPost = (characterId: number) => {
        if (!post.visibility || post.visibility === 'public') return true
        if (post.visibility === 'private') return false
        return post.visibleTo?.includes(characterId) ?? false
    }
    const candidates = audience.filter(
        (item) =>
            item.id !== post.author.id &&
            (post.author.type === 'user' || introducedTo.includes(item.id)) &&
            canViewPost(item.id)
    )
    if (candidates.length === 0) return post

    const shuffled = [...candidates].sort(
        (a, b) => stableRandom(seed + a.id) - stableRandom(seed + b.id)
    )
    const likeCount = Math.min(shuffled.length, 1 + Math.floor(stableRandom(seed + 2) * 3))
    const commentCount = Math.min(shuffled.length, Math.floor(stableRandom(seed + 3) * 2.5))

    const likes = shuffled.slice(0, likeCount).map((item, index) => ({
        actor: makeActor(item),
        createdAt: post.createdAt + index * 1000,
    }))
    const comments = shuffled.slice(0, commentCount).map((item, index) => ({
        id: makeId('comment', seed + index),
        actor: makeActor(item),
        content: personaComment(item, seed + index + 31),
        createdAt: post.createdAt + 1500 + index * 1500,
    }))

    return { ...post, likes, comments }
}

const createLife = (character: SocialCharacterSeed, now: number, seedOffset = 0): CharacterLife => {
    const seed = character.id * 97 + Math.floor(now / 60000) + seedOffset
    const event = makeEvent(character, seed, now)
    return {
        characterId: character.id,
        characterName: character.name,
        imageId: character.imageId,
        personality: character.personality ?? '',
        description: character.description ?? '',
        currentActivity: event.activity,
        location: event.location,
        lastUpdatedAt: now,
        nextPostAt: now + 45000 + Math.floor(stableRandom(seed) * 150000),
        events: [event],
        introducedTo: [],
    }
}

const refreshLifeProfile = (
    life: CharacterLife,
    character: SocialCharacterSeed
): CharacterLife => ({
    ...life,
    characterName: character.name,
    imageId: character.imageId,
    personality: character.personality ?? '',
    description: character.description ?? '',
})

export const useSocialStore = create<SocialState>()(
    persist(
        (set, get) => ({
            posts: [],
            lives: {},
            relations: [],

            syncCharacters: (characters, seededAt = getNetworkNow()) => {
                const generated: SocialPost[] = []
                set((state) => {
                    const lives = { ...state.lives }
                    const posts = [...state.posts]

                    characters.forEach((character, index) => {
                        const key = String(character.id)
                        if (lives[key]) {
                            lives[key] = refreshLifeProfile(lives[key], character)
                            return
                        }

                        const life = createLife(character, seededAt - index * 90000, index)
                        lives[key] = life
                        const event = life.events[0]
                        const post: SocialPost = {
                            id: makeId('post', character.id * 1000 + index),
                            author: makeActor(character),
                            content: event.activity,
                            location: event.location,
                            createdAt: event.createdAt,
                            likes: [],
                            comments: [],
                        }
                        const enriched = seedInteractions(
                            post,
                            characters,
                            character.id + index,
                            life.introducedTo
                        )
                        posts.unshift(enriched)
                        generated.push(enriched)
                    })

                    return { lives, posts: posts.slice(0, 500) }
                })
                return generated
            },

            tick: (characters) => {
                const generated: SocialPost[] = []
                const now = getNetworkNow()

                set((state) => {
                    const lives = { ...state.lives }
                    let posts = [...state.posts]

                    characters.forEach((character, index) => {
                        const key = String(character.id)
                        let life = lives[key]
                        if (!life) {
                            life = createLife(character, now, index)
                        }
                        life = refreshLifeProfile(life, character)

                        if (now < life.nextPostAt) {
                            lives[key] = life
                            return
                        }

                        const seed = character.id * 131 + Math.floor(now / 60000) + index
                        const event = makeEvent(character, seed, now)
                        const post: SocialPost = {
                            id: makeId('post', seed),
                            author: makeActor(character),
                            content: event.activity,
                            location: event.location,
                            createdAt: now,
                            likes: [],
                            comments: [],
                        }
                        const enriched = seedInteractions(post, characters, seed, life.introducedTo)
                        posts = [enriched, ...posts].slice(0, 500)
                        generated.push(enriched)

                        life = {
                            ...life,
                            currentActivity: event.activity,
                            location: event.location,
                            lastUpdatedAt: now,
                            nextPostAt: now + 90000 + Math.floor(stableRandom(seed) * 300000),
                            events: [event, ...life.events].slice(0, 30),
                        }
                        lives[key] = life
                    })

                    return { lives, posts }
                })

                return generated
            },

            publishPost: (author, content, location, audience, options) => {
                const trimmed = content.trim()
                if (!trimmed) return undefined

                const now = getNetworkNow()
                const seed = now + author.id
                const requestedVisibility = options?.visibility ?? 'public'
                const visibleTo = [...new Set(options?.visibleTo ?? [])]
                const visibility =
                    requestedVisibility === 'selected' && visibleTo.length === 0
                        ? 'private'
                        : requestedVisibility
                const post: SocialPost = {
                    id: makeId('post', seed),
                    author,
                    content: trimmed,
                    location,
                    visibility,
                    visibleTo: visibility === 'selected' ? visibleTo : undefined,
                    createdAt: now,
                    likes: [],
                    comments: [],
                }
                const enriched = seedInteractions(post, audience, seed)
                set((state) => ({ posts: [enriched, ...state.posts].slice(0, 500) }))
                return enriched.id
            },

            toggleLike: (postId, actor) => {
                set((state) => ({
                    posts: state.posts.map((post) => {
                        if (post.id !== postId) return post
                        const liked = post.likes.some(
                            (item) => item.actor.type === actor.type && item.actor.id === actor.id
                        )
                        return {
                            ...post,
                            likes: liked
                                ? post.likes.filter(
                                      (item) =>
                                          !(
                                              item.actor.type === actor.type &&
                                              item.actor.id === actor.id
                                          )
                                  )
                                : [{ actor, createdAt: getNetworkNow() }, ...post.likes],
                        }
                    }),
                }))
            },

            addComment: (postId, actor, content, audience = []) => {
                const trimmed = content.trim()
                if (!trimmed) return
                const now = getNetworkNow()
                set((state) => ({
                    posts: state.posts.map((post) => {
                        if (post.id !== postId) return post
                        const comments = [
                            ...post.comments,
                            {
                                id: makeId('comment', now + actor.id),
                                actor,
                                content: trimmed,
                                createdAt: now,
                            },
                        ]
                        if (actor.type === 'user') {
                            const canViewPost = (characterId: number) => {
                                if (!post.visibility || post.visibility === 'public') return true
                                if (post.visibility === 'private') return false
                                return post.visibleTo?.includes(characterId) ?? false
                            }
                            const authorLife = state.lives[String(post.author.id)]
                            const introducedTo = authorLife?.introducedTo ?? []
                            const candidates = audience.filter(
                                (item) =>
                                    item.id !== post.author.id &&
                                    (post.author.type === 'user' ||
                                        introducedTo.includes(item.id)) &&
                                    canViewPost(item.id) &&
                                    !comments.some((comment) => comment.actor.id === item.id)
                            )
                            if (candidates.length > 0) {
                                const reply = pick(candidates, now + postId.length)
                                comments.push({
                                    id: makeId('reply', now + reply.id),
                                    actor: makeActor(reply),
                                    content: pick(replyPool, now + reply.id),
                                    createdAt: now + 1200,
                                })
                            }
                        }
                        return { ...post, comments }
                    }),
                }))
            },

            introduceByCard: (user, fromId, toId, characters, location) => {
                if (fromId === toId) return ''
                const first = characters.find((item) => item.id === fromId)
                const second = characters.find((item) => item.id === toId)
                if (!first || !second) return ''
                const seed = getNetworkNow()

                const relation: SocialRelation = {
                    id: makeId('relation', seed),
                    aId: first.id,
                    bId: second.id,
                    introducedBy: user.name,
                    createdAt: seed,
                }
                const place = location ?? pick(SOCIAL_LOCATIONS, seed + 4)
                const post: SocialPost = {
                    id: makeId('post', seed + 9),
                    author: makeActor(second),
                    content: `今天通过 ${user.name} 拿到了 ${first.name} 的名片，聊了一会儿，感觉还不错。`,
                    location: place,
                    createdAt: seed,
                    likes: [{ actor: makeActor(first), createdAt: seed + 800 }],
                    comments: [
                        {
                            id: makeId('comment', seed + 10),
                            actor: makeActor(first),
                            content: pick(replyPool, seed + 2),
                            createdAt: seed + 1500,
                        },
                    ],
                }

                set((state) => {
                    const lives = { ...state.lives }
                    const firstLife = lives[String(first.id)]
                    const secondLife = lives[String(second.id)]
                    if (firstLife && !firstLife.introducedTo.includes(second.id)) {
                        lives[String(first.id)] = {
                            ...firstLife,
                            introducedTo: [...firstLife.introducedTo, second.id],
                        }
                    }
                    if (secondLife && !secondLife.introducedTo.includes(first.id)) {
                        lives[String(second.id)] = {
                            ...secondLife,
                            introducedTo: [...secondLife.introducedTo, first.id],
                        }
                    }
                    return {
                        lives,
                        relations: [relation, ...state.relations],
                        posts: [post, ...state.posts].slice(0, 500),
                    }
                })

                return `${first.name} 的名片已推荐给 ${second.name}`
            },

            removeCharacter: (characterId) => {
                set((state) => {
                    const lives = { ...state.lives }
                    delete lives[String(characterId)]
                    return {
                        lives,
                        relations: state.relations.filter(
                            (item) => item.aId !== characterId && item.bId !== characterId
                        ),
                        posts: state.posts
                            .filter(
                                (post) =>
                                    !(
                                        post.author.type === 'character' &&
                                        post.author.id === characterId
                                    )
                            )
                            .map((post) => ({
                                ...post,
                                visibleTo: post.visibleTo?.filter((item) => item !== characterId),
                                likes: post.likes.filter(
                                    (item) =>
                                        !(
                                            item.actor.type === 'character' &&
                                            item.actor.id === characterId
                                        )
                                ),
                                comments: post.comments.filter(
                                    (item) =>
                                        !(
                                            item.actor.type === 'character' &&
                                            item.actor.id === characterId
                                        )
                                ),
                            })),
                    }
                })
            },

            clear: () => set({ posts: [], lives: {}, relations: [] }),
        }),
        {
            name: Storage.Social,
            storage: createMMKVStorage(),
            version: 1,
            partialize: (state) => ({
                posts: state.posts,
                lives: state.lives,
                relations: state.relations,
            }),
        }
    )
)
