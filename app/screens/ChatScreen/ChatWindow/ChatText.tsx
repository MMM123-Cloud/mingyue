import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Easing, useAnimatedValue, View } from 'react-native'
import Markdown from 'react-native-markdown-display'

import ThemedButton from '@components/buttons/ThemedButton'
import { useTextFilter } from '@lib/hooks/TextFilter'
import { sanitizeAssistantOutput } from '@lib/constants/ContentRules'
import { splitNarration } from '@lib/markdown/Narration'
import { MarkdownStyle } from '@lib/markdown/Markdown'

type ChatTextProps = {
    swipeText: string
    isUser?: boolean
    variant?: 'all' | 'dialogue'
}

const ChatText: React.FC<ChatTextProps> = ({ swipeText, isUser = false, variant = 'all' }) => {
    const { t } = useTranslation()
    const { markdown, rules, style } = MarkdownStyle.useCustomFormatting()
    const [showHidden, setShowHidden] = useState(false)
    const viewRef = useRef<View>(null)
    const animHeight = useAnimatedValue(-1)
    const targetHeight = useRef(-1)
    const firstRender = useRef(true)

    const handleAnimateHeight = (newheight: number) => {
        animHeight.stopAnimation(() =>
            Animated.timing(animHeight, {
                toValue: newheight,
                duration: 150,
                useNativeDriver: false,
                easing: Easing.inOut((x) => x * x),
            }).start()
        )
    }
    const updateHeight = () => {
        viewRef.current?.measure((_, __, ___, measuredHeight) => {
            if (firstRender.current) {
                animHeight.setValue(measuredHeight)
                return (firstRender.current = false)
            }
            if (targetHeight.current === measuredHeight) return
            if (targetHeight.current > -1) animHeight.setValue(targetHeight.current)
            handleAnimateHeight(measuredHeight)
            targetHeight.current = measuredHeight
        })
    }

    const safeText = isUser ? swipeText : sanitizeAssistantOutput(swipeText)
    const filteredText = useTextFilter(safeText?.trim() ?? '')
    const visibleText = showHidden ? safeText?.trim() : filteredText.result
    const renderedText =
        variant === 'dialogue' ? splitNarration(visibleText).dialogue : visibleText
    return (
        <Animated.View style={{ overflow: 'scroll', height: animHeight }}>
            <View style={{ minHeight: 10 }} ref={viewRef} onLayout={updateHeight}>
                <Markdown mergeStyle={false} markdownit={markdown} rules={rules} style={style}>
                    {renderedText}
                </Markdown>
                {filteredText.found && (
                    <View style={{ flexDirection: 'row' }}>
                        <ThemedButton
                            onPress={() => setShowHidden(!showHidden)}
                            variant="secondary"
                            label={
                                showHidden
                                    ? t('chat.filteredText.hide')
                                    : t('chat.filteredText.show')
                            }
                            labelStyle={{ flex: 0, fontSize: 12 }}
                            buttonStyle={{
                                paddingVertical: 0,
                                paddingBottom: 0,
                                paddingHorizontal: 0,
                                borderWidth: 0,
                            }}
                        />
                    </View>
                )}
            </View>
        </Animated.View>
    )
}

export default ChatText
