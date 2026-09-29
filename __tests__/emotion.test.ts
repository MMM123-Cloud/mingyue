import {
    buildEmotionDirective,
    inferUserEmotion,
} from '../lib/constants/EmotionalSupport'

test('reads the dominant emotion from the latest user message', () => {
    expect(inferUserEmotion('今天真的好累，什么都不想动')).toBe('tired')
    expect(inferUserEmotion('刚刚被领导骂了，凭什么是我')).toBe('angry')
    expect(inferUserEmotion('一个人在家，没人理我')).toBe('lonely')
    expect(inferUserEmotion('我明天要面试，好紧张，睡不着')).toBe('anxious')
    expect(inferUserEmotion('我拿到offer了，太开心了哈哈')).toBe('happy')
    expect(inferUserEmotion('有点想你了')).toBe('affectionate')
    expect(inferUserEmotion('心里好难受，想哭')).toBe('sad')
})

test('falls back to neutral when there is no clear signal', () => {
    expect(inferUserEmotion('今天几号')).toBe('neutral')
    expect(inferUserEmotion('')).toBe('neutral')
    expect(inferUserEmotion(undefined)).toBe('neutral')
})

test('picks the stronger signal when a message mixes emotions', () => {
    // 焦虑命中一次权重 3；疲惫命中一次权重 2。焦虑更具体，应该赢。
    expect(inferUserEmotion('很累，可是又很焦虑')).toBe('anxious')
})

test('every tone produces a non-empty directive', () => {
    const tones = [
        'neutral',
        'sad',
        'anxious',
        'angry',
        'lonely',
        'tired',
        'happy',
        'affectionate',
    ] as const
    for (const tone of tones) {
        const directive = buildEmotionDirective(tone)
        expect(directive).toContain('【本轮情绪阅读】')
        expect(directive.length).toBeGreaterThan(20)
    }
})
