/**
 * 记忆召回排序。
 *
 * 原来的 `Memories.forContext` 只按「重要度 + 时间」取前 N 条，注入时也不再重排，
 * 于是无论用户当前在聊什么，塞进去的永远是那几条最重要的记忆。相关的内容反而
 * 可能排不进去。
 *
 * 这里改用「当前对话的相关度优先」来排序：词项 + 中文二元组做词汇匹配，不需要
 * 嵌入模型，也不需要联网，手机上单次开销可以忽略。这是 RikkaHub Plus (Lantern)
 * 在语义检索之外保留的那条 lexical fallback 路径。
 *
 * 纯函数，不依赖数据库，便于测试。
 */

export type RecallCandidate = {
    id: number
    content: string
    importance: number
    created_at: number
    last_recalled_at?: number | null
    recall_count?: number
}

const LATIN_TERM = /[a-z0-9]{3,}/g

// 中文里单字区分度太低，用二元组更接近词。只过滤纯虚词构成的二元组。
const CJK_STOPWORD_CHARS = new Set(
    '的了是我你他她它们这那有和就不也很都会说吗呢啊吧么什怎么着过要能可以被把给对在到与及或但而而且所以如果因为因此一个没不'.split(
        ''
    )
)
const CJK_RUN = /[\u4e00-\u9fff]+/g

export const extractTerms = (text?: string): Set<string> => {
    const terms = new Set<string>()
    if (!text) return terms

    const lower = text.toLowerCase()

    for (const match of lower.matchAll(LATIN_TERM)) {
        terms.add(match[0])
    }

    for (const run of lower.matchAll(CJK_RUN)) {
        const chars = [...run[0]]
        if (chars.length === 1) {
            terms.add(chars[0])
            continue
        }
        for (let i = 0; i + 1 < chars.length; i++) {
            const bigram = chars[i] + chars[i + 1]
            // 两个字符都是虚词时，这个二元组几乎没有信息量。
            if (CJK_STOPWORD_CHARS.has(chars[i]) && CJK_STOPWORD_CHARS.has(chars[i + 1])) continue
            terms.add(bigram)
        }
    }

    return terms
}

export const countTermHits = (memoryTerms: Set<string>, queryTerms: Set<string>) => {
    if (memoryTerms.size === 0 || queryTerms.size === 0) return 0
    let hits = 0
    memoryTerms.forEach((term) => {
        if (queryTerms.has(term)) hits++
    })
    return hits
}

/**
 * 相关度，0..1。
 *
 * 只按命中计数，不用「命中数 / 记忆词数」这种比例：长记忆会被自己的长度稀释，
 * 一条长记忆里只命中一个词，反而会输给短却很关键的记忆。命中一次就说明这条
 * 记忆谈到了当前话题，本身就是强信号，给 0.5 起步；命中越多越接近 1。
 */
export const scoreRelevance = (hits: number) =>
    hits <= 0 ? 0 : Math.min(1, 0.5 + (0.5 * Math.min(hits, 3)) / 3)

const normalize = (value: number, min: number, max: number) =>
    max <= min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)))

export type RankMemoryOptions = {
    queryText?: string
    now?: number
}

/**
 * 相关性优先排序。没有 queryText（对话刚开始，还没有可参考的上下文）时退回
 * 「重要度 + 时间」，这也正是首轮应该注入最近记忆的原因。
 */
export const rankMemoriesForContext = <T extends RecallCandidate>(
    memories: T[],
    { queryText, now = Date.now() }: RankMemoryOptions = {}
): T[] => {
    const queryTerms = extractTerms(queryText)
    const hasQuery = queryTerms.size > 0

    const scored = memories.map((memory) => {
        const relevance = hasQuery
            ? scoreRelevance(countTermHits(extractTerms(memory.content), queryTerms))
            : 0
        const importance = normalize(memory.importance, 20, 100)
        const ageDays = Math.max(0, (now - memory.created_at) / 86400000)
        const recency = 1 - normalize(ageDays, 0, 90)

        // 刚被召回过的记忆先降温，避免每一轮都把同几条塞给模型。
        const sinceRecallDays = memory.last_recalled_at
            ? Math.max(0, (now - memory.last_recalled_at) / 86400000)
            : Number.POSITIVE_INFINITY
        const fatigue =
            sinceRecallDays < 1 ? 3 : sinceRecallDays < 3 ? 2 : sinceRecallDays < 7 ? 1 : 0
        const repeatPenalty = fatigue / Math.max(1, (memory.recall_count ?? 0) + 1)

        const score = hasQuery
            ? relevance * 100 + importance * 30 + recency * 15 - repeatPenalty * 12
            : importance * 70 + recency * 30 - repeatPenalty * 4

        return { memory, score, relevance }
    })

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.memory.created_at - a.memory.created_at
    })

    return scored.map((item) => item.memory)
}
