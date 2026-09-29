import { BlurTargetView, BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'

const GlassContext = createContext<{
    target?: React.RefObject<View | null>
    reducedTransparency: boolean
}>({ reducedTransparency: false })

export const isLightColor = (hex: string) => {
    const value = withAlpha(hex, '').slice(1)
    return (
        parseInt(value.slice(0, 2), 16) * 0.299 +
            parseInt(value.slice(2, 4), 16) * 0.587 +
            parseInt(value.slice(4, 6), 16) * 0.114 >
        150
    )
}

/** A shared static backdrop keeps glass inexpensive during local inference. */
export const GlassProvider = ({ children }: PropsWithChildren) => {
    const target = useRef<View>(null)
    const { color } = Theme.useTheme()
    const light = isLightColor(color.neutral._100)
    const [reducedTransparency, setReducedTransparency] = useState(false)
    useEffect(() => {
        let active = true
        void AccessibilityInfo.isReduceTransparencyEnabled()
            .then((enabled) => active && setReducedTransparency(enabled))
            .catch(() => undefined)
        const subscription = AccessibilityInfo.addEventListener(
            'reduceTransparencyChanged',
            setReducedTransparency
        )
        return () => {
            active = false
            subscription.remove()
        }
    }, [])
    return (
        <GlassContext.Provider value={{ target, reducedTransparency }}>
            <View style={{ flex: 1, backgroundColor: color.neutral._100 }}>
                <BlurTargetView ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={[color.neutral._100, color.primary._100, color.neutral._100]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.75, y: 1 }}
                        style={[StyleSheet.absoluteFill, { opacity: light ? 0.65 : 0.4 }]}
                    />
                    <LinearGradient
                        colors={[
                            withAlpha(color.primary._300, light ? '52' : '35'),
                            withAlpha(color.primary._100, '00'),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={styles.daylight}
                    />
                    <View
                        style={[
                            styles.horizon,
                            { borderColor: withAlpha(color.primary._300, '38') },
                        ]}
                    />
                </BlurTargetView>
                {children}
            </View>
        </GlassContext.Provider>
    )
}

/** Lens material belongs to controls. Content cards use the opaque default. */
export const GlassPanel = ({
    children,
    style,
    blur = false,
    intensity = 16,
}: PropsWithChildren<{
    style?: StyleProp<ViewStyle>
    blur?: boolean
    intensity?: number
}>) => {
    const { target, reducedTransparency } = useContext(GlassContext)
    const { color } = Theme.useTheme()
    const light = isLightColor(color.neutral._100)
    const flattened = StyleSheet.flatten(style) ?? {}
    const radius = typeof flattened.borderRadius === 'number' ? flattened.borderRadius : 24
    const glass = blur && !reducedTransparency
    return (
        <View
            style={[
                {
                    borderRadius: radius,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    backgroundColor: glass
                        ? withAlpha(color.neutral._200, light ? '94' : 'C4')
                        : color.neutral._200,
                    borderWidth: 1,
                    borderColor: glass
                        ? withAlpha(color.neutral._200, light ? 'E8' : '58')
                        : withAlpha(color.neutral._400, '80'),
                    boxShadow: glass
                        ? `0px 8px 24px ${withAlpha(color.neutral._900, light ? '0B' : '20')}`
                        : undefined,
                },
                style,
            ]}>
            {glass && target && (
                <BlurView
                    pointerEvents="none"
                    blurTarget={target}
                    blurMethod="dimezisBlurViewSdk31Plus"
                    intensity={intensity}
                    tint={light ? 'light' : 'dark'}
                    liquidGlassStrength={0.82}
                    liquidGlassRadius={radius}
                    style={StyleSheet.absoluteFill}
                />
            )}
            {glass && (
                <>
                    <View
                        pointerEvents="none"
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: withAlpha(color.neutral._200, light ? 'B4' : '60') },
                        ]}
                    />
                    <LinearGradient
                        pointerEvents="none"
                        colors={[
                            withAlpha(color.neutral._200, light ? '90' : '10'),
                            withAlpha(color.neutral._200, '08'),
                            withAlpha(color.primary._200, light ? '24' : '14'),
                        ]}
                        locations={[0, 0.4, 1]}
                        start={{ x: 0.1, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </>
            )}
            {children}
            {glass && (
                <View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            borderRadius: radius,
                            borderWidth: 1,
                            borderTopColor: withAlpha(color.neutral._200, light ? 'F0' : '50'),
                            borderLeftColor: withAlpha(color.neutral._200, light ? 'CC' : '30'),
                            borderRightColor: withAlpha(color.primary._400, '28'),
                            borderBottomColor: withAlpha(color.primary._400, '35'),
                        },
                    ]}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    daylight: {
        position: 'absolute',
        top: -160,
        right: -140,
        width: 500,
        height: 520,
        borderRadius: 260,
        opacity: 0.8,
    },
    horizon: {
        position: 'absolute',
        bottom: -280,
        left: -160,
        width: 600,
        height: 480,
        borderRadius: 300,
        borderWidth: 1,
        transform: [{ rotate: '-18deg' }],
    },
})
