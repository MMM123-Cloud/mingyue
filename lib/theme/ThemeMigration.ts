import { DefaultColorSchemes, ThemeColor } from './ThemeColor'

type SavedTheme = {
    color?: ThemeColor
    lightColor?: ThemeColor
    darkColor?: ThemeColor
    useSystemDarkMode?: boolean
    customColors?: ThemeColor[]
}

/** Refresh built-in defaults for the light redesign without erasing custom themes. */
export const migrateLiquidTheme = (saved: SavedTheme): SavedTheme => {
    const builtin = (theme?: ThemeColor) => !theme || ['明月 Dark', '月白'].includes(theme.name)
    return {
        ...saved,
        color: builtin(saved.color) ? DefaultColorSchemes.yueBaiLight : saved.color,
        lightColor: builtin(saved.lightColor) ? DefaultColorSchemes.yueBaiLight : saved.lightColor,
        darkColor: builtin(saved.darkColor) ? DefaultColorSchemes.mingYueDark : saved.darkColor,
    }
}
