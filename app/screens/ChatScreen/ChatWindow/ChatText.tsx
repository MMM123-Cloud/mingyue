import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
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

    const safeText = isUser ? swipeText : sanitizeAssistantOutput(swipeText)
    const filteredText = useTextFilter(safeText?.trim() ?? '')
    const visibleText = showHidden ? safeText?.trim() : filteredText.result
    const renderedText = variant === 'dialogue' ? splitNarration(visibleText).dialogue : visibleText
    return (
        <View style={{ minHeight: 10 }}>
            <Markdown mergeStyle={false} markdownit={markdown} rules={rules} style={style}>
                {renderedText}
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
                            paddingBottom: 0,
                            paddingHorizontal: 0,
                            borderWidth: 0,
                        }}
                    />
                </View>
            )}
        </View>
    )
}

export default ChatText
