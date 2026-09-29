import { DefaultColorSchemes } from '../lib/theme/ThemeColor'
import { migrateLiquidTheme } from '../lib/theme/ThemeMigration'

test('the previous built-in dark default upgrades to the new light theme', () => {
    const upgraded = migrateLiquidTheme({
        color: DefaultColorSchemes.mingYueDark,
        useSystemDarkMode: false,
    })
    expect(upgraded.color).toBe(DefaultColorSchemes.yueBaiLight)
    expect(upgraded.darkColor).toBe(DefaultColorSchemes.mingYueDark)
    expect(upgraded.useSystemDarkMode).toBe(false)
})

test('a user custom theme and system mode preference survive the redesign', () => {
    const custom = { ...DefaultColorSchemes.yueBaiLight, name: '我的自定义主题' }
    const upgraded = migrateLiquidTheme({
        color: custom,
        lightColor: custom,
        customColors: [custom],
        useSystemDarkMode: true,
    })
    expect(upgraded.color).toBe(custom)
    expect(upgraded.lightColor).toBe(custom)
    expect(upgraded.customColors).toEqual([custom])
    expect(upgraded.useSystemDarkMode).toBe(true)
})
