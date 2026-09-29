import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { usePathname } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { FlatList } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { MoonHomeHeader } from '@lib/ui/LiquidHome'
import { useSocialEngine } from '@lib/hooks/SocialEngine'
import { Characters, CharInfo, MAX_CONTACTS } from '@lib/state/Characters'
import { CharacterSorter } from '@lib/state/CharacterSorter'
import { useDeveloperModeStore } from '@lib/state/DeveloperMode'
import { TagHider } from '@lib/state/TagHider'
import { Theme } from '@lib/theme/ThemeManager'

import CharacterListHeader from './CharacterListHeader'
import CharacterListing from './CharacterListing'
import CharacterNewMenu from './CharacterNewMenu'
import CharactersEmpty from '@lib/ui/LiquidEmpty'
import CharactersSearchEmpty from './CharactersSearchEmpty'

const PAGE_SIZE = 30

const CharacterList: React.FC = () => {
    const { t } = useTranslation()
    const { color } = Theme.useTheme()
    useSocialEngine()
    const developerMode = useDeveloperModeStore((state) => state.enabled)
    const [nowLoading, setNowLoading] = useState(false)
    const { searchType, searchOrder, tagFilter, textFilter } = CharacterSorter.useSorterStore(
        useShallow((state) => ({
            searchType: state.searchType,
            searchOrder: state.searchOrder,
            tagFilter: state.tagFilter,
            textFilter: state.textFilter,
        }))
    )
    const hiddenTags = TagHider.useHiddenTags()
    const filterKey = JSON.stringify([searchType, searchOrder, textFilter, tagFilter, hiddenTags])
    const [pagination, setPagination] = useState({ key: filterKey, pages: 3 })
    const pages = pagination.key === filterKey ? pagination.pages : 3
    const previousLength = useRef(0)
    useEffect(() => {
        previousLength.current = 0
    }, [filterKey])
    const { data, updatedAt } = useLiveQuery(
        Characters.db.query.cardListQueryWindow(
            'character',
            searchType,
            searchOrder,
            PAGE_SIZE * pages,
            0,
            textFilter,
            tagFilter,
            hiddenTags
        ),
        [searchType, searchOrder, textFilter, tagFilter, hiddenTags, pages]
    )

    const characterList: CharInfo[] = useMemo(() => {
        return data.map((item) => ({
            ...item,
            latestChat: item.chats[0]?.id,
            latestSwipe: item.chats[0]?.messages[0]?.swipes[0]?.swipe,
            latestName: item.chats[0]?.messages[0]?.name,
            deletedAt: item.deleted_at ?? undefined,
            last_modified: item.last_modified ?? 0,
            tags: item.tags.map((item) => item.tag.tag),
        }))
    }, [data])

    // do not render when not shown, optimizes some rerenders
    const path = usePathname()
    if (path !== '/') return

    return (
        <View style={{ flex: 1, width: '100%', maxWidth: 920, alignSelf: 'center' }}>
            <View style={{ flex: 1 }}>
                <FlatList
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={{ marginHorizontal: -20 }}>
                            <MoonHomeHeader />
                            <View
                                style={{
                                    marginHorizontal: 12,
                                    marginBottom: 4,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    backgroundColor: 'transparent',
                                    borderRadius: 20,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}>
                                <Text
                                    style={{
                                        color: color.text._300,
                                        fontSize: 15,
                                        fontWeight: '500',
                                        flexShrink: 1,
                                        marginRight: 8,
                                    }}>
                                    {developerMode
                                        ? `联系人 ${characterList.filter((item) => !item.deletedAt).length}（开发者，不限人数）`
                                        : `我的联系人 · ${characterList.filter((item) => !item.deletedAt).length}/${MAX_CONTACTS}`}
                                </Text>
                                <CharacterNewMenu
                                    showLabel
                                    nowLoading={nowLoading}
                                    setNowLoading={setNowLoading}
                                />
                            </View>
                            <CharacterListHeader resultLength={characterList.length} />
                        </View>
                    }
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingTop: 4,
                        paddingBottom: 24,
                        rowGap: 12,
                    }}
                    data={characterList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <CharacterListing
                            character={item}
                            nowLoading={nowLoading}
                            setNowLoading={setNowLoading}
                        />
                    )}
                    onEndReachedThreshold={1}
                    onEndReached={() => {
                        if (
                            previousLength.current === data.length ||
                            data.length < PAGE_SIZE * pages
                        ) {
                            return
                        }
                        previousLength.current = data.length
                        setPagination((current) => ({
                            key: filterKey,
                            pages: (current.key === filterKey ? current.pages : 3) + 1,
                        }))
                    }}
                    windowSize={3}
                    ListEmptyComponent={() =>
                        updatedAt ? (
                            textFilter || tagFilter.length ? (
                                <CharactersSearchEmpty />
                            ) : (
                                <CharactersEmpty />
                            )
                        ) : null
                    }
                />
            </View>

            {characterList.length === 0 && data.length !== 0 && updatedAt && (
                <CharactersSearchEmpty />
            )}
        </View>
    )
}

export default CharacterList
