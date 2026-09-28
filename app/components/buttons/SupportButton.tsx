import MaterialIcons from '@react-native-vector-icons/material-icons/static'
import { useRouter } from 'expo-router'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { Theme } from '@lib/theme/ThemeManager'

import ThemedButton from './ThemedButton'

const SupportButton = () => {
    const theme = Theme.useTheme()
    const { t } = useTranslation()
    const router = useRouter()

    return (
        <ThemedButton
            onPress={() => router.push('/screens/SupportScreen')}
            variant="secondary"
            label={t('supportPage.button')}
            icon={<MaterialIcons name="support-agent" size={16} color={theme.color.primary._700} />}
        />
    )
}

export default SupportButton
