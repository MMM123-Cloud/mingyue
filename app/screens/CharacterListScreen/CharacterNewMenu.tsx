import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { useBottomSheetRef } from '@components/views/BottomSheet'
import ContextMenu from '@components/views/ContextMenu'
import InputSheet from '@components/views/InputSheet'
import { Characters } from '@lib/state/Characters'
import { Logger } from '@lib/state/Logger'
import { Theme } from '@lib/theme/ThemeManager'

type CharacterNewMenuProps = {
    nowLoading: boolean
    setNowLoading: (b: boolean) => void
    showLabel?: boolean
}

const CharacterNewMenu: React.FC<CharacterNewMenuProps> = ({
    nowLoading,
    setNowLoading,
    showLabel = false,
}) => {
    const { t } = useTranslation()
    const { color } = Theme.useTheme()
    const { setCurrentCard } = Characters.useCharacterStore(
        useShallow((state) => ({
            setCurrentCard: state.setCard,
            id: state.id,
        }))
    )

    const router = useRouter()
    const inputRef = useBottomSheetRef()

    const handleCreateCharacter = async (text: string) => {
        if (!text) {
            Logger.errorToast(t('character.list.errors.nameEmpty'))
            return
        }
        Characters.db.mutate.createCard(text).then(async (id) => {
            if (id < 0) {
                setNowLoading(false)
                return
            }
            if (nowLoading) return
            setNowLoading(true)
            await setCurrentCard(id)
            setNowLoading(false)
            router.push('/screens/CharacterEditorScreen')
        })
    }

    return (
        <>
            <InputSheet
                ref={inputRef}
                title={t('character.list.actions.createNewCharacter')}
                onConfirm={handleCreateCharacter}
                verifyText={(text) =>
                    text.length === 0 ? t('character.list.errors.nameCannotBeEmpty') : ''
                }
                placeholder="Name..."
                autoFocus
                confirmLabel={t('common.actions.create')}
            />

            <ContextMenu
                triggerIcon="user-add"
                disabled={nowLoading}
                buttons={[
                    {
                        label: t('character.list.actions.importFromFile'),
                        onPress: (close) => {
                            Characters.importCharacter()
                            close()
                        },
                        icon: 'upload',
                    },
                    {
                        label: t('character.list.actions.createCharacter'),
                        onPress: (close) => {
                            inputRef.current?.open()
                            close()
                        },
                        icon: 'edit',
                    },
                ]}
                placement="bottom"
                >
                {showLabel && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            columnGap: 6,
                            backgroundColor: color.primary._100,
                            borderColor: color.primary._400,
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                        }}>
                        <AntDesign name="user-add" size={18} color={color.primary._700} />
                        <Text style={{ color: color.primary._700, fontWeight: '600' }}>
                            {t('character.list.actions.addContact')}
                        </Text>
                    </View>
                )}
            </ContextMenu>
        </>
    )
}

export default CharacterNewMenu
