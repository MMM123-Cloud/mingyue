import { DefaultColorSchemes, themeColorSchemaV1, withAlpha } from '../lib/theme/ThemeColor'

test('glass alpha supports short custom colors and replaces existing transparency', () => {
    expect(withAlpha('#abc', 'B8')).toBe('#aabbccB8')
    expect(withAlpha('#11223380', 'DD')).toBe('#112233DD')
    expect(withAlpha('#112233', '00')).toBe('#11223300')
    expect(withAlpha('#abc', '')).toBe('#aabbcc')
})

test('the bundled light and dark themes can be exported and imported without schema errors', () => {
    expect(themeColorSchemaV1.safeParse(DefaultColorSchemes.mingYueDark).success).toBe(true)
    expect(themeColorSchemaV1.safeParse(DefaultColorSchemes.yueBaiLight).success).toBe(true)
})
