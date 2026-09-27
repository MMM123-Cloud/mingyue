import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { usePathname } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import Alert from '@components/views/Alert'
import Drawer from '@components/views/Drawer'
import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import { useSocialEngine } from '@lib/hooks/SocialEngine'
import { Characters, CharInfo, MAX_CONTACTS } from '@lib/state/Characters'
import { CharacterSorter } from '@lib/state/CharacterSorter'
import { useDeveloperContactStore } from '@lib/state/DeveloperContact'
import { useDeveloperModeStore } from '@lib/state/DeveloperMode'
import { TagHider } from '@lib/state/TagHider'
import { Theme } from '@lib/theme/ThemeManager'

import CharacterListHeader from './CharacterListHeader'
import CharacterListing from './CharacterListing'
import CharacterNewMenu from './CharacterNewMenu'
import DeveloperContactListing from './DeveloperContactListing'
import CharactersEmpty from './CharactersEmpty'
import CharactersSearchEmpty from './CharactersSearchEmpty'

const PAGE_SIZE = 30

const CharacterList: React.FC = () => {
    const { t } = useTranslation()
    const { color } = Theme.useTheme()
    useSocialEngine()
    const developerMode = useDeveloperModeStore((state) => state.enabled)
    const developerRequested = useRef(false)
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
    const [pages, setPages] = useState(3)
    const [previousLength, setPreviousLength] = useState(0)
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

    useEffect(() => {
        if (developerRequested.current) return
        const developer = useDeveloperContactStore.getState()
        if (developer.status !== 'none' && developer.status !== 'prompted') return
        developerRequested.current = true
        developer.request()
        Alert.alert({
            title: '开发者申请添加好友',
            description: '开发者：加个好友吧？同意后我会把使用教程和声明发给你。',
            buttons: [
                {
                    label: '拒绝',
                    onPress: () => useDeveloperContactStore.getState().reject(),
                },
                {
                    label: '同意',
                    onPress: () => useDeveloperContactStore.getState().accept(),
                },
            ],
        })
    }, [])

    // do not render when not shown, optimizes some rerenders
    const path = usePathname()
    if (path !== '/') return

    return (
        <View style={{ paddingTop: 8, flex: 1, backgroundColor: color.neutral._100 }}>
            <HeaderTitle title={t('common.brand.name')} />
            <HeaderButton
                headerLeft={() => <Drawer.Button drawerID={Drawer.ID.SETTINGS} />}
            />

            <CharacterListHeader resultLength={characterList.length} />
            <View
                style={{
                    marginHorizontal: 12,
                    marginBottom: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: color.neutral._200,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: color.neutral._300,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                <Text
                    style={{
                        color: color.text._500,
                        fontSize: 12,
                        flexShrink: 1,
                        marginRight: 8,
                    }}>
                    {developerMode
                        ? `联系人 ${characterList.filter((item) => !item.deletedAt).length}（开发者，不限人数）`
                        : `联系人 ${characterList.filter((item) => !item.deletedAt).length}/${MAX_CONTACTS}`}
                </Text>
                <CharacterNewMenu
                    showLabel
                    nowLoading={nowLoading}
                    setNowLoading={setNowLoading}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Animated.FlatList
                    layout={LinearTransition}
                    itemLayoutAnimation={LinearTransition}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: 12,
                        paddingTop: 4,
                        paddingBottom: 24,
                        rowGap: 8,
                        backgroundColor: color.neutral._100,
                    }}
                    ListHeaderComponent={DeveloperContactListing}
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
                        if (previousLength === data.length) {
                            return
                        }
                        setPreviousLength(data.length)
                        setPages(pages + 1)
                    }}
                    windowSize={3}
                    onStartReachedThreshold={0.1}
                    onStartReached={() => {
                        if (pages !== 3) setPages(3)
                    }}
                    ListEmptyComponent={() => data.length === 0 && updatedAt && <CharactersEmpty />}
                />
            </View>

            {characterList.length === 0 && data.length !== 0 && updatedAt && (
                <CharactersSearchEmpty />
            )}
        </View>
    )
}

export default CharacterList
