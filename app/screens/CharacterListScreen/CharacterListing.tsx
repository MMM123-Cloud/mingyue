import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'
import { useShallow } from 'zustand/react/shallow'

import Avatar from '@components/views/Avatar'
import { AppSettings } from '@lib/constants/GlobalValues'
import { Characters, CharInfo } from '@lib/state/Characters'
import { CharacterSorter } from '@lib/state/CharacterSorter'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'
import { getFriendlyTimeStamp } from '@lib/utils/Time'

import CharacterEditPopup from './CharacterEditPopup'
import CharacterListingTags from './CharacterListingTags'

type CharacterListingProps = {
    character: CharInfo
    nowLoading: boolean
    setNowLoading: (b: boolean) => void
}

const CharacterListing: React.FC<CharacterListingProps> = ({
    character,
    nowLoading,
    setNowLoading,
}) => {
    const { t } = useTranslation()
    const [showTags] = useMMKVBoolean(AppSettings.ShowTags)
    const { setShowSearch, setTagFilter, tagFilter } = CharacterSorter.useSorterStore(
        useShallow((state) => ({
            setShowSearch: state.setShowSearch,
            setTagFilter: state.setTagFilter,
            tagFilter: state.tagFilter,
        }))
    )
    const styles = useStyles()

    const getPreviewText = () => {
        if (character.deletedAt) return t('character.list.deleted')
        if (character.latestSwipe === undefined || !character.latestName)
            return t('character.list.emptyStates.noMessages')
        return character.latestName + ':  ' + character.latestSwipe.trim()
    }

    return (
        <View>
            <CharacterEditPopup
                character={character}
                setNowLoading={setNowLoading}
                nowLoading={nowLoading}>
                <View style={styles.longButtonContainer}>
                    <Avatar
                        targetImage={Characters.getImageDir(character.image_id)}
                        style={styles.avatar}
                    />

                    <View style={{ flex: 1, paddingLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text
                                style={[
                                    styles.nametag,
                                    character.deletedAt ? styles.deletedName : undefined,
                                ]}
                                numberOfLines={2}>
                                {character.name}
                            </Text>
                            <Text style={styles.timestamp}>
                                {getFriendlyTimeStamp(character.last_modified)}
                            </Text>
                        </View>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.previewText}>
                            {getPreviewText()}
                        </Text>
                    </View>
                </View>
            </CharacterEditPopup>
            <CharacterListingTags
                tags={character.tags}
                showTags={showTags!}
                onPress={(tag: string) => {
                    setShowSearch(true)
                    if (tagFilter.includes(tag)) return
                    setTagFilter([...tagFilter, tag])
                }}
            />
        </View>
    )
}

export default CharacterListing

const useStyles = () => {
    const { color, spacing, borderRadius, fontSize } = Theme.useTheme()

    return StyleSheet.create({
        longButtonContainer: {
            flexDirection: 'row',
            backgroundColor: withAlpha(color.neutral._200, 'B8'),
            borderWidth: 1,
            borderColor: withAlpha(color.neutral._400, '90'),
            borderRadius: 22,
            flex: 1,
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.xl,
        },

        avatar: {
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: color.neutral._300,
            borderColor: withAlpha(color.neutral._400, '90'),
            borderWidth: 1,
        },

        nametag: {
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: color.text._100,
        },

        deletedName: {
            color: color.text._500,
        },

        timestamp: {
            fontSize: fontSize.s,
            color: color.text._400,
        },

        previewText: {
            marginTop: spacing.s,
            color: color.text._300,
            fontSize: 14,
        },
    })
}
