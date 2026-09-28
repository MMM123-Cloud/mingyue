import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import Markdown from 'react-native-markdown-display'

import ThemedButton from '@components/buttons/ThemedButton'
import AnimatedEllipsis from '@components/text/AnimatedEllipsis'
import { sanitizeAssistantOutput } from '@lib/constants/ContentRules'
import { ChatSwipe } from '@db/schema'
import { useTextFilter } from '@lib/hooks/TextFilter'
import { splitNarration } from '@lib/markdown/Narration'
import { MarkdownStyle } from '@lib/markdown/Markdown'
import { Chats, useInference } from '@lib/state/Chat'

type ChatTextProps = {
    nowGenerating: boolean
    swipe: ChatSwipe
    isUser?: boolean
    variant?: 'all' | 'dialogue'
}

const ChatTextLast: React.FC<ChatTextProps> = ({
    nowGenerating,
    swipe,
    isUser = false,
    variant = 'all',
}) => {
    const { t } = useTranslation()
    const { markdown, rules, style } = MarkdownStyle.useCustomFormatting()

    const { buffer } = Chats.useBuffer()
    const [showHidden, setShowHidden] = useState(false)
    const currentSwipeId = useInference((state) => state.currentSwipeId)

    const safeSwipe = isUser ? (swipe.swipe ?? '') : sanitizeAssistantOutput(swipe.swipe ?? '')
    const filteredText = useTextFilter(safeSwipe)
    const renderedText = showHidden ? safeSwipe : filteredText.result
    const generatingText = sanitizeAssistantOutput(buffer.data).trim()
    const activeText = nowGenerating && swipe.id === currentSwipeId ? generatingText : renderedText
    const displayText = variant === 'dialogue' ? splitNarration(activeText).dialogue : activeText

    return (
        <View style={{ minHeight: 10 }}>
            {swipe.id === currentSwipeId && nowGenerating && generatingText === '' && (
                <AnimatedEllipsis />
            )}
            <Markdown mergeStyle={false} markdownit={markdown} rules={rules} style={style}>
                {displayText}
            </Markdown>
            {filteredText.found && (
                <View style={{ flexDirection: 'row' }}>
                    <ThemedButton
                        onPress={() => setShowHidden(!showHidden)}
                        variant="secondary"
                        label={
                            showHidden ? t('chat.filteredText.hide') : t('chat.filteredText.show')
                        }
                        labelStyle={{ flex: 0, fontSize: 12 }}
                        buttonStyle={{
                            paddingVertical: 0,
                            paddingHorizontal: 0,
                            borderWidth: 0,
                        }}
                    />
                </View>
            )}
        </View>
    )
}

export default ChatTextLast
