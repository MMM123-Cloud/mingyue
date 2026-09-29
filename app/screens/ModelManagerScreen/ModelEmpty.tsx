import AntDesign from '@react-native-vector-icons/ant-design/static'
import { Trans } from 'react-i18next'
import { Text, View } from 'react-native'

import { Theme } from '@lib/theme/ThemeManager'

const ModelEmpty = () => {
    const { color, spacing, fontSize } = Theme.useTheme()
    return (
        <View
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                flex: 1,
            }}>
            <AntDesign name="file-add" size={32} color={color.text._500} />
            <Text
                style={{
                    color: color.text._400,
                    marginTop: spacing.xl,
                    fontSize: fontSize.m,
                    textAlign: 'center',
                    lineHeight: 24,
                }}>
                <Trans i18nKey="model.empty" />
            </Text>
        </View>
    )
}

export default ModelEmpty
