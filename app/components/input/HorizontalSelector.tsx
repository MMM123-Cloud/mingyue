import MaterialIcons, {
    MaterialIconsIconName,
} from '@react-native-vector-icons/material-icons/static'
import { useCallback, useEffect, useRef } from 'react'
import { Pressable, Text, View, ViewStyle } from 'react-native'
import Animated, {
    Easing,
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'

import { Theme } from '@lib/theme/ThemeManager'

type HorizontalSelectorProps<T> = {
    values: {
        label: string
        value: T
        icon?: MaterialIconsIconName
        iconSize?: number
    }[]
    selected: T
    onPress: (selected: T) => void
    label?: string
    description?: string
    style?: ViewStyle
    capitalizeValues?: string
}

const HorizontalSelector = <T,>({
    values,
    selected,
    onPress,
    label,
    description,
    style,
}: HorizontalSelectorProps<T>) => {
    const { color, spacing, fontSize } = Theme.useTheme()
    const viewRef = useRef<View>(null)
    const initialRender = useRef(true)
    const animatedValues = useSharedValue({
        top: 0,
        left: 0,
        width: 0,
        height: 0,
    })
    const animatedStyle = useAnimatedStyle(() => {
        return animatedValues.value
    })

    const measureSelection = useCallback(() => {
        if (!viewRef.current) return
        viewRef.current.measure((x, y, width, height, pageX, pageY) => {
            animatedValues.value = withTiming(
                {
                    top: y + 2,
                    left: x + 2,
                    width: width - 4,
                    height: height - 4,
                },
                {
                    duration: initialRender.current ? 0 : 180,
                    easing: Easing.out(Easing.ease),
                    reduceMotion: ReduceMotion.System,
                }
            )
        })
        initialRender.current = false
    }, [animatedValues])
    useEffect(measureSelection, [measureSelection, selected])

    return (
        <View style={[{ flex: 1 }, style]}>
            {label && (
                <Text
                    style={{
                        flex: style?.flex ?? 1,
                        color: color.text._100,
                        paddingBottom: spacing.s,
                    }}>
                    {label}
                </Text>
            )}

            <View
                onLayout={measureSelection}
                accessibilityRole="radiogroup"
                style={{
                    flex: style?.flex ?? 1,
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                    backgroundColor: color.neutral._300,
                    padding: 2,
                    borderRadius: 26,
                }}>
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            backgroundColor: color.primary._200,
                            borderRadius: 22,
                        },
                        animatedStyle,
                    ]}
                />

                {values.map((item, index) => {
                    const isSelected = item.value === selected
                    return (
                        <Pressable
                            accessibilityRole="radio"
                            accessibilityLabel={item.label}
                            accessibilityState={{ checked: isSelected }}
                            onLayout={isSelected ? measureSelection : undefined}
                            ref={isSelected ? viewRef : null}
                            key={index}
                            onPress={() => onPress(item.value)}
                            style={{
                                flex: 1,
                                minHeight: 48,
                                paddingHorizontal: 8,
                                borderRadius: 24,
                                paddingVertical: spacing.m,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                columnGap: 8,
                            }}>
                            {item.icon && (
                                <MaterialIcons
                                    name={item.icon}
                                    size={item.iconSize ?? 16}
                                    color={color.text[isSelected ? '_200' : '_500']}
                                />
                            )}
                            <Text
                                style={{
                                    color: color.text[isSelected ? '_200' : '_500'],
                                    fontSize: fontSize.s,
                                }}>
                                {item.label}
                            </Text>
                        </Pressable>
                    )
                })}
            </View>

            {description && (
                <Text
                    style={{
                        color: color.text._400,
                        marginTop: 4,
                        paddingBottom: spacing.xs,
                        marginBottom: spacing.m,
                    }}>
                    {description}
                </Text>
            )}
        </View>
    )
}

export default HorizontalSelector
