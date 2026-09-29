import { LinearGradient } from 'expo-linear-gradient'

import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'

const ChatHeaderGradient = () => {
    const { color } = Theme.useTheme()
    return (
        <LinearGradient
            colors={[color.neutral._100, withAlpha(color.neutral._100, '22')]}
            style={{
                position: 'absolute',
                width: '100%',
                top: 0,
                height: 8,
            }}
        />
    )
}

export default ChatHeaderGradient
