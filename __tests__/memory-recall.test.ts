import {
    countTermHits,
    extractTerms,
    rankMemoriesForContext,
    scoreRelevance,
    type RecallCandidate,
} from '../lib/state/MemoryRecall'

const DAY = 86400000
const NOW = Date.UTC(2026, 8, 29)

const memory = (over: Partial<RecallCandidate> & { id: number }): RecallCandidate => ({
    content: '',
    importance: 40,
    created_at: NOW - DAY,
    ...over,
})

test('extracts latin words and CJK bigrams, dropping pure function-word pairs', () => {
    const terms = extractTerms('我 喜欢 coffee 的味道')
    expect(terms.has('coffee')).toBe(true)
    expect(terms.has('喜欢')).toBe(true)
    expect(terms.has('味道')).toBe(true)
    // 「我的」两个字符都是虚词，不该留下
    expect(terms.has('我的')).toBe(false)
})

test('relevance scores by hit count so one hit is already a strong signal', () => {
    const memoryTerms = extractTerms('用户讨厌香菜')
    const matched = countTermHits(memoryTerms, extractTerms('今晚吃什么，我讨厌香菜'))
    expect(matched).toBeGreaterThan(0)
    expect(scoreRelevance(matched)).toBeGreaterThanOrEqual(0.5)

    expect(countTermHits(memoryTerms, extractTerms('今天天气不错'))).toBe(0)
    expect(scoreRelevance(0)).toBe(0)
    expect(scoreRelevance(1)).toBeLessThan(scoreRelevance(3))
    expect(scoreRelevance(3)).toBe(1)
    expect(scoreRelevance(9)).toBe(1)
})

test('a relevant memory outranks a higher-importance irrelevant one', () => {
    const memories = [
        memory({ id: 1, content: '用户的银行卡密码是六位数字', importance: 95 }),
        memory({ id: 2, content: '用户讨厌香菜，闻到就想吐', importance: 45 }),
    ]
    const ranked = rankMemoriesForContext(memories, {
        queryText: '晚上点外卖，记得别放香菜',
        now: NOW,
    })
    expect(ranked[0].id).toBe(2)
})

test('without a query it falls back to importance then recency', () => {
    const memories = [
        memory({ id: 1, content: '旧的普通印象', importance: 40, created_at: NOW - 30 * DAY }),
        memory({ id: 2, content: '重要印象', importance: 90, created_at: NOW - 20 * DAY }),
        memory({ id: 3, content: '另一条普通印象', importance: 40, created_at: NOW - DAY }),
    ]
    const ranked = rankMemoriesForContext(memories, { now: NOW })
    expect(ranked[0].id).toBe(2)
    // 同重要度时更新的排前面
    expect(ranked[1].id).toBe(3)
})

test('a memory recalled a moment ago is cooled down', () => {
    const fresh = memory({
        id: 1,
        content: '用户养了一只叫团子的猫',
        importance: 60,
        last_recalled_at: NOW - 60000,
        recall_count: 3,
    })
    const untouched = memory({ id: 2, content: '用户养了一只叫团子的猫', importance: 60 })
    const ranked = rankMemoriesForContext([fresh, untouched], {
        queryText: '团子今天怎么样',
        now: NOW,
    })
    expect(ranked[0].id).toBe(2)
})
