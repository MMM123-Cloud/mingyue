import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getNetworkNow } from '@lib/utils/NetworkTime'
import { Storage } from '@lib/enums/Storage'
import { createMMKVStorage } from '@lib/storage/MMKV'

import { useDeveloperContactStore } from './DeveloperContact'

export type PartnerRequestStatus = 'none' | 'sent' | 'accepted' | 'declined'

export type RelationshipProfile = {
    intimacy: number
    personaClarity: number
    birthday: string
    specialDatesText: string
    knowsUserBirthday: boolean
    partnerRequest: PartnerRequestStatus
    partnerRequestedAt?: number
    lastGiftAt?: number
    giftAffectionDate?: string
    giftAffectionToday?: number
    chatAffectionDate?: string
    chatAffectionGainToday?: number
    lastOwnBirthdayGreetingYear?: number
    lastUserBirthdayGreetingYear?: number
    greetedSpecialDateKeys: string[]
}

type RelationshipState = {
    profiles: Record<string, RelationshipProfile>
    userBirthday: string
    partnerCharacterId?: number
    ensureProfile: (characterId: number) => void
    recordInteraction: (
        characterId: number,
        importance?: number,
        speaker?: 'user' | 'contact',
        content?: string
    ) => void
    setBirthday: (characterId: number, birthday: string) => void
    setSpecialDatesText: (characterId: number, text: string) => void
    setKnowsUserBirthday: (characterId: number, knows: boolean) => void
    requestPartner: (characterId: number) => boolean
    respondPartnerRequest: (characterId: number, accept: boolean) => boolean
    releasePartner: (characterId: number) => void
    markOwnBirthdayGreeted: (characterId: number, year: number) => void
    markUserBirthdayGreeted: (characterId: number, year: number) => void
    markSpecialDateGreeted: (characterId: number, key: string) => void
    markGiftSent: (characterId: number, sentAt?: number) => void
    recordGiftTransfer: (characterId: number, amount: number) => number
    setIntimacy: (characterId: number, intimacy: number) => void
    setUserBirthday: (birthday: string) => void
    removeCharacter: (characterId: number) => void
    clear: () => void
}

const createProfile = (): RelationshipProfile => ({
    intimacy: 0,
    personaClarity: 0,
    birthday: '',
    specialDatesText: '',
    knowsUserBirthday: true,
    partnerRequest: 'none',
    greetedSpecialDateKeys: [],
})

const getProfile = (
    profiles: Record<string, RelationshipProfile>,
    characterId: number
): RelationshipProfile => profiles[String(characterId)] ?? createProfile()

export const getIntimacyGain = (importance = 40) => {
    if (importance >= 90) return 3
    if (importance >= 60) return 2
    return 1
}

export const CHAT_INTIMACY_DAILY_CAP = 10

const hostileUserMessagePattern =
    /滚|去死|死开|闭嘴|别烦我|烦死|讨厌你|分手|绝交|傻逼|智障|废物|垃圾|恶心/i

export const getIntimacyChange = (
    importance = 40,
    speaker?: 'user' | 'contact',
    content?: string
) => {
    const magnitude = getIntimacyGain(importance)
    if (speaker === 'user' && content && hostileUserMessagePattern.test(content)) {
        return -magnitude
    }
    return magnitude
}

export type RelationshipToneGuideInput = {
    personality?: string | null
    description?: string | null
    intimacy: number
    personaClarity: number
    isPartner: boolean
}

const introvertedPersonaPattern =
    /内向|腼腆|害羞|慢热|社恐|沉默|寡言|安静|清冷|怯生|不善表达|不擅长表达/i

export const buildRelationshipToneGuide = ({
    personality,
    description,
    intimacy,
    personaClarity,
    isPartner,
}: RelationshipToneGuideInput) => {
    const isIntroverted = introvertedPersonaPattern.test(
        `${personality ?? ''} ${description ?? ''}`
    )
    const closeness = Math.max(0, Math.min(100, intimacy))

    let stageRule: string
    if (closeness < 15) {
        stageRule = isIntroverted
            ? '你们还处在刚开始认识的阶段。作为内向或慢热的人，你回复偏短、留有余地，很少主动开启话题，也不会突然使用亲密称呼或表现得过分热情。'
            : '你们还处在刚开始认识的阶段。保持礼貌、自然和符合人设的分寸，不默认已经很熟，也不突然使用亲密称呼。'
    } else if (closeness < 40) {
        stageRule = isIntroverted
            ? '你开始熟悉用户，会记住一些细节并偶尔主动关心，但表达仍克制。你可以比对陌生人时多说一点，却不立刻变成外向健谈的人。'
            : '你已经开始熟悉用户，语气可以比初识时放松，愿意回应日常话题并偶尔主动关心，但仍尊重彼此的边界。'
    } else if (closeness < 70) {
        stageRule = isIntroverted
            ? '你们已经互相信任。你愿意分享一点自己的日常、真实感受和少量玩笑，主动次数也会增加；亲近体现在放松和坦诚，而不是强行变得话多。'
            : '你们已经互相信任。可以自然地分享日常、表达真实感受、开符合人设的玩笑，并表现出稳定的关心。'
    } else if (closeness < 90) {
        stageRule = isIntroverted
            ? '你与用户很亲近，开始出现依赖、想念和只给对方看的柔软，也能主动联系；即使如此，你仍保留内向者安静、含蓄或慢热的底色。'
            : '你与用户很亲近，会更主动地联系、关心、分享和表达想念；亲近方式要符合你原有的性格与相处习惯。'
    } else {
        stageRule = isIntroverted
            ? '你们处在极亲密或情侣阶段。你可以更直接地表达想念、爱意、吃醋和需要，也会主动亲近；变化来自安全感和关系的加深，不是把内向人格替换成另一个人。'
            : '你们处在极亲密或情侣阶段。可以更直接地表达偏爱、想念、吃醋和需要，但表达方式仍要能看出是你本人。'
    }

    const clarityRule =
        personaClarity <= 25
            ? '你对这段关系和自己的表达习惯还在逐步认识，只依据已经发生的互动判断，不要编造共同经历或突然确定从未表现过的偏好。'
            : personaClarity <= 60
              ? '你已经开始明确自己的喜好、边界、习惯和亲近方式；这些变化要能从前面的相处自然长出来，并保持前后一致。'
              : '你的表达习惯已经较稳定；可以因经历变得更细腻、更坦诚，但新反应必须符合长期人设，不能毫无理由地推翻自己。'

    const partnerRule = isPartner
        ? '你与用户是唯一情侣关系。可以有专属称呼、偏爱和符合人设的占有欲，但不要把情侣关系演成与原先性格无关的模板化甜蜜。'
        : '你们即使很亲近，在情侣关系没有自然确认前，也不要把用户称作恋人，或声称已经建立情侣关系。'

    return [
        '【关系表达演化】',
        '亲密会改变表达方式，但不会替换核心人格。变化必须缓慢、连续，并以真实互动为依据。',
        stageRule,
        clarityRule,
        partnerRule,
    ].join('\n')
}

const affectionatePersonaPattern =
    /温柔|体贴|安静|成熟|高冷|冷淡|傲娇|毒舌|活泼|开朗|热情|元气|直球|黏人|依赖|保护|关心|恋人|亲密|喜欢|爱|占有|认真|细腻|浪漫/i
const incompatiblePersonaPattern =
    /客服|助理|机器人|ai助手|儿童|未成年|小学生|初中生|高中生|老师|上司|陌生人|医生|律师|经纪/i

const hashString = (value: string) =>
    value.split('').reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0)

export const canProactivelyOfferPartnership = (
    characterId: number,
    name: string,
    personality: string,
    description: string,
    personaClarity: number
) => {
    const profile = `${name} ${personality} ${description}`
    if (incompatiblePersonaPattern.test(profile)) return false
    if (affectionatePersonaPattern.test(profile)) return personaClarity >= 20
    return personaClarity >= 70 && hashString(`${characterId}-${profile}`) % 100 < 55
}

export const parseSpecialDates = (text: string) => {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [date, ...labelParts] = line.split('|')
            return {
                date: date.trim(),
                label: labelParts.join('|').trim() || '特别的日子',
            }
        })
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))
}

export const buildPartnerRequestText = (name: string, personality: string) => {
    const profile = `${name} ${personality}`.toLowerCase()
    if (/高冷|冷淡|傲娇|毒舌/.test(profile)) {
        return `[情侣申请]\n${name}：本来不想说得这么直接。可如果对象是你的话，我想认真试一次。`
    }
    if (/温柔|体贴|安静|成熟/.test(profile)) {
        return `[情侣申请]\n${name}：我想了很久，还是想把这句话认真告诉你。你愿意和我在一起吗？`
    }
    if (/活泼|开朗|热情|元气/.test(profile)) {
        return `[情侣申请]\n${name}：我不管啦，我就是想和你在一起！你愿不愿意收下我呀？`
    }
    return `[情侣申请]\n${name}：我想再靠近你一点。你愿意让我成为你的唯一吗？`
}

export type GiftAcceptanceInput = {
    characterId: number
    name: string
    personality?: string | null
    description?: string | null
    amount: number
    intimacy: number
    isPartner: boolean
}

export const canAcceptGift = ({
    characterId,
    name,
    personality,
    description,
    amount,
    intimacy,
    isPartner,
}: GiftAcceptanceInput) => {
    const profile = `${name} ${personality ?? ''} ${description ?? ''}`
    let rejectChance = 8
    if (/高冷|冷淡|傲娇|毒舌|清冷|自尊|要强|独立/.test(profile)) {
        rejectChance = amount > 10000 ? 78 : amount > 5000 ? 58 : amount > 1000 ? 28 : 10
    } else if (/理性|谨慎|成熟|稳重|克制|慢热|内向/.test(profile)) {
        rejectChance = amount > 20000 ? 65 : amount > 10000 ? 42 : amount > 5000 ? 22 : 7
    } else if (/温柔|体贴|细腻|安静/.test(profile)) {
        rejectChance = amount > 30000 ? 45 : amount > 20000 ? 25 : amount > 10000 ? 12 : 4
    } else if (/活泼|开朗|热情|元气|直率/.test(profile)) {
        rejectChance = amount > 30000 ? 38 : amount > 15000 ? 20 : amount > 5000 ? 9 : 3
    } else {
        rejectChance = amount > 20000 ? 55 : amount > 10000 ? 35 : amount > 5000 ? 18 : 6
    }

    if (intimacy >= 80 || isPartner) rejectChance -= 35
    else if (intimacy >= 55) rejectChance -= 18
    if (amount <= 20) rejectChance = Math.min(rejectChance, 4)
    const roll =
        hashString(`${characterId}-${Math.floor(getNetworkNow() / 86400000)}-${amount}`) % 100
    return roll >= Math.max(0, rejectChance)
}

export const buildGiftRejectionText = (
    name: string,
    personality: string | null | undefined,
    amount: number
) => {
    const profile = `${name} ${personality ?? ''}`
    if (/高冷|冷淡|傲娇|毒舌|要强|独立/.test(profile)) {
        return `转账已退回。\n${name}：钱你收回去。想靠近我的话，不用拿这个证明。`
    }
    if (/理性|谨慎|成熟|稳重|克制|慢热|内向/.test(profile)) {
        return `转账已退回。\n${name}：这笔我不能收，太多了。你的心意我知道了，但我更想慢慢来。`
    }
    return `转账已退回。\n${name}：¥${amount.toFixed(2)} 还是先退给你吧。这个数目让我有点不自在，换种方式对我好也可以。`
}

export const useRelationshipStore = create<RelationshipState>()(
    persist(
        (set, get) => ({
            profiles: {},
            userBirthday: '',
            partnerCharacterId: undefined,
            ensureProfile: (characterId) => {
                const key = String(characterId)
                if (get().profiles[key]) return
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: createProfile(),
                    },
                }))
            },
            recordInteraction: (characterId, importance = 40, speaker, content) => {
                const key = String(characterId)
                set((state) => {
                    const profile = getProfile(state.profiles, characterId)
                    const clarityGain = speaker === 'contact' && content?.length ? 2 : 1
                    const today = new Date(getNetworkNow()).toDateString()
                    const gainedToday =
                        profile.chatAffectionDate === today
                            ? (profile.chatAffectionGainToday ?? 0)
                            : 0
                    const requestedChange = getIntimacyChange(importance, speaker, content)
                    const intimacyChange =
                        requestedChange > 0
                            ? Math.min(
                                  requestedChange,
                                  Math.max(0, CHAT_INTIMACY_DAILY_CAP - gainedToday)
                              )
                            : requestedChange
                    return {
                        profiles: {
                            ...state.profiles,
                            [key]: {
                                ...profile,
                                personaClarity: Math.min(100, profile.personaClarity + clarityGain),
                                intimacy: Math.max(
                                    0,
                                    Math.min(100, profile.intimacy + intimacyChange)
                                ),
                                chatAffectionDate: today,
                                chatAffectionGainToday: gainedToday + Math.max(0, intimacyChange),
                            },
                        },
                    }
                })
            },
            setBirthday: (characterId, birthday) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            birthday,
                        },
                    },
                }))
            },
            setSpecialDatesText: (characterId, specialDatesText) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            specialDatesText,
                        },
                    },
                }))
            },
            setKnowsUserBirthday: (characterId, knowsUserBirthday) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            knowsUserBirthday,
                        },
                    },
                }))
            },
            requestPartner: (characterId) => {
                const existingPartner = get().partnerCharacterId
                if (existingPartner !== undefined && existingPartner !== characterId) {
                    useDeveloperContactStore.getState().sendPureLoveWarning()
                    return false
                }
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            partnerRequest: 'sent',
                            partnerRequestedAt: getNetworkNow(),
                        },
                    },
                }))
                return true
            },
            respondPartnerRequest: (characterId, accept) => {
                if (!accept) {
                    const key = String(characterId)
                    set((state) => ({
                        profiles: {
                            ...state.profiles,
                            [key]: {
                                ...getProfile(state.profiles, characterId),
                                partnerRequest: 'declined',
                            },
                        },
                    }))
                    return true
                }

                const existingPartner = get().partnerCharacterId
                if (existingPartner !== undefined && existingPartner !== characterId) {
                    useDeveloperContactStore.getState().sendPureLoveWarning()
                    return false
                }

                const key = String(characterId)
                set((state) => ({
                    partnerCharacterId: characterId,
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            partnerRequest: 'accepted',
                            partnerRequestedAt: getNetworkNow(),
                        },
                    },
                }))
                return true
            },
            releasePartner: (characterId) => {
                if (get().partnerCharacterId !== characterId) return
                const key = String(characterId)
                set((state) => ({
                    partnerCharacterId: undefined,
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            partnerRequest: 'none',
                        },
                    },
                }))
            },
            markOwnBirthdayGreeted: (characterId, year) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            lastOwnBirthdayGreetingYear: year,
                        },
                    },
                }))
            },
            markUserBirthdayGreeted: (characterId, year) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            lastUserBirthdayGreetingYear: year,
                        },
                    },
                }))
            },
            markSpecialDateGreeted: (characterId, key) => {
                const profileKey = String(characterId)
                set((state) => {
                    const profile = getProfile(state.profiles, characterId)
                    if (profile.greetedSpecialDateKeys.includes(key)) return state
                    return {
                        profiles: {
                            ...state.profiles,
                            [profileKey]: {
                                ...profile,
                                greetedSpecialDateKeys: [
                                    ...profile.greetedSpecialDateKeys,
                                    key,
                                ].slice(-80),
                            },
                        },
                    }
                })
            },
            markGiftSent: (characterId, sentAt = getNetworkNow()) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            lastGiftAt: sentAt,
                        },
                    },
                }))
            },
            recordGiftTransfer: (characterId, amount) => {
                const key = String(characterId)
                const today = new Date(getNetworkNow()).toDateString()
                const profile = getProfile(get().profiles, characterId)
                const alreadyToday =
                    profile.giftAffectionDate === today ? (profile.giftAffectionToday ?? 0) : 0
                const potentialGain = amount >= 1000 ? 2 : amount >= 100 ? 1 : 0
                const gain = Math.max(0, Math.min(2 - alreadyToday, potentialGain))
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            intimacy: Math.min(100, profile.intimacy + gain),
                            personaClarity: Math.min(
                                100,
                                profile.personaClarity + (gain > 0 ? 1 : 0)
                            ),
                            lastGiftAt: getNetworkNow(),
                            giftAffectionDate: today,
                            giftAffectionToday: alreadyToday + gain,
                        },
                    },
                }))
                return gain
            },
            setIntimacy: (characterId, intimacy) => {
                const key = String(characterId)
                set((state) => ({
                    profiles: {
                        ...state.profiles,
                        [key]: {
                            ...getProfile(state.profiles, characterId),
                            intimacy: Math.max(0, Math.min(100, Math.round(intimacy))),
                        },
                    },
                }))
            },
            setUserBirthday: (userBirthday) => set({ userBirthday }),
            removeCharacter: (characterId) => {
                const key = String(characterId)
                set((state) => {
                    const profiles = { ...state.profiles }
                    delete profiles[key]
                    return {
                        profiles,
                        partnerCharacterId:
                            state.partnerCharacterId === characterId
                                ? undefined
                                : state.partnerCharacterId,
                    }
                })
            },
            clear: () => set({ profiles: {}, userBirthday: '', partnerCharacterId: undefined }),
        }),
        {
            name: Storage.Relationships,
            storage: createMMKVStorage(),
            version: 1,
        }
    )
)
