import { ImageBackground } from 'expo-image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList } from 'react-native'
import { useMMKVBoolean } from 'react-native-mmkv'
import { useShallow } from 'zustand/react/shallow'

import Drawer from '@components/views/Drawer'
import HeaderTitle from '@components/views/HeaderTitle'
import { AppSettings } from '@lib/constants/GlobalValues'
import { useDebounce } from '@lib/hooks/Debounce'
import { useLiveQueryJoined } from '@lib/hooks/LiveQueryJoined'
import { useAppMode } from '@lib/state/AppMode'
import { useBackgroundStore } from '@lib/state/BackgroundImage'
import { Characters } from '@lib/state/Characters'
import { Chats, ScrollData } from '@lib/state/Chat'
import { AppDirectory } from '@lib/utils/File'
import { Theme } from '@lib/theme/ThemeManager'

import ChatFooter from './ChatFooter'
import ChatHeader from './ChatHeader'
import ChatHeaderGradient from './ChatHeaderGradient'
import ChatItem from './ChatItem'
import ChatJumpButton from './ChatJumpButton'
import ChatModelName from './ChatModelName'

type ChatWindowProps = {
    chatId: number
    scrollData?: ScrollData
}

type ChatRow = {
    index: number
    entryId: number
    isGreeting: boolean
    isLastMessage: boolean
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, scrollData }) => {
    const charId = Characters.useCharacterStore((state) => state.card?.id)
    const { color } = Theme.useTheme()

    const { appMode } = useAppMode()
    const [saveScroll] = useMMKVBoolean(AppSettings.SaveScrollPosition)
    const [showModelname] = useMMKVBoolean(AppSettings.ShowModelInChat)
    const [showJump, setShowJump] = useState(false)
    const [autoScroll] = useMMKVBoolean(AppSettings.AutoScroll)
    const { data: { background_image: backgroundImage } = {} } = useLiveQueryJoined(
        Characters.db.query.backgroundImageQuery(charId ?? -1),
        [charId],
        { deepCheck: true }
    )

    const { data: entryIdList, updatedAt } = useLiveQueryJoined(Chats.db.live.entryIdList(chatId), [
        chatId,
        {
            sync: true,
        },
    ])

    const { cause: scrollCause, index: scrollIndex } = scrollData ?? {}
    const flatlistRef = useRef<FlatList<ChatRow> | null>(null)
    const { showSettings, showChat } = Drawer.useDrawerStore(
        useShallow((state) => ({
            showSettings: state.values?.[Drawer.ID.SETTINGS],
            showChat: state.values?.[Drawer.ID.CHATLIST],
        }))
    )

    const updateScrollPosition = useDebounce((position: number, chatId: number) => {
        if (chatId) {
            Chats.db.mutate.updateScrollOffset(chatId, position)
        }
    }, 200)

    const rows = useMemo<ChatRow[]>(
        () =>
            entryIdList.map((item, index) => ({
                index: entryIdList.length - index - 1,
                entryId: item.id,
                isGreeting: index === entryIdList.length - 1,
                isLastMessage: index === 0,
            })),
        [entryIdList]
    )

    const showJumpRef = useRef(false)
    const chatIdRef = useRef(chatId)
    const updateScrollRef = useRef(updateScrollPosition)
    chatIdRef.current = chatId
    updateScrollRef.current = updateScrollPosition

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 20,
        minimumViewTime: 120,
    }).current

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
            const index = viewableItems[0]?.index
            if (index == null) return

            if (chatIdRef.current) {
                updateScrollRef.current(
                    index - (viewableItems.length === 1 ? 1 : 0),
                    chatIdRef.current
                )
            }

            const nextShowJump = index > 15
            if (showJumpRef.current !== nextShowJump) {
                showJumpRef.current = nextShowJump
                setShowJump(nextShowJump)
            }
        }
    ).current

    const renderItem = useCallback(
        ({ item }: { item: ChatRow }) => (
            <ChatItem
                index={item.index}
                entryId={item.entryId}
                isLastMessage={item.isLastMessage}
                isGreeting={item.isGreeting}
            />
        ),
        []
    )

    const keyExtractor = useCallback((item: ChatRow) => item.entryId.toString(), [])

    const image = useBackgroundStore((state) => state.image)
    const backgroundSource = useMemo(
        () => ({
            uri: backgroundImage
                ? Characters.getImageDir(backgroundImage)
                : image
                  ? AppDirectory.Assets + image
                  : '',
        }),
        [backgroundImage, image]
    )
    const contentContainerStyle = useMemo(() => ({ paddingBottom: 104, rowGap: 10 }), [])
    const maintainVisibleContentPosition = useMemo(
        () => (autoScroll ? null : { minIndexForVisible: 0, autoscrollToTopThreshold: 50 }),
        [autoScroll]
    )

    const onScrollToIndexFailed = useCallback(
        (error: { index: number; averageItemLength: number }) => {
            flatlistRef.current?.scrollToOffset({
                offset: error.averageItemLength * error.index,
                animated: true,
            })
            setTimeout(() => {
                if (entryIdList.length !== 0 && flatlistRef.current !== null) {
                    flatlistRef.current?.scrollToIndex({
                        index: error.index,
                        animated: true,
                        viewOffset: 32,
                    })
                }
            }, 100)
        },
        [entryIdList.length]
    )

    useEffect(() => {
        if (!scrollCause || !scrollIndex) return
        const isSave = scrollCause === 'saveScroll'
        if (!saveScroll && isSave) return
        const offset = Math.max(0, scrollIndex + (isSave ? 1 : 0))

        if (offset > 2)
            flatlistRef.current?.scrollToIndex({
                index: offset,
                animated: scrollCause === 'search',
                viewOffset: 32,
            })
    }, [scrollCause, scrollIndex, saveScroll])

    return (
        <ImageBackground
            cachePolicy="memory-disk"
            style={{ flex: 1, backgroundColor: color.neutral._100 }}
            source={backgroundSource}>
            {showModelname && appMode === 'local' && (
                <HeaderTitle headerTitle={() => !showSettings && !showChat && <ChatModelName />} />
            )}

            <FlatList<ChatRow>
                ref={flatlistRef}
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                keyboardShouldPersistTaps="handled"
                inverted
                data={rows}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                updateCellsBatchingPeriod={40}
                windowSize={7}
                onScrollToIndexFailed={onScrollToIndexFailed}
                contentContainerStyle={contentContainerStyle}
                ListFooterComponent={
                    updatedAt ? <ChatFooter chatLength={entryIdList.length} /> : undefined
                }
                ListHeaderComponent={<ChatHeader />}
            />
            <ChatJumpButton
                jump={() => {
                    showJumpRef.current = false
                    setShowJump(false)
                    flatlistRef?.current?.scrollToIndex({
                        index: 0,
                        animated: false,
                        viewPosition: 1,
                    })
                }}
                visible={showJump}
            />

            <ChatHeaderGradient />
        </ImageBackground>
    )
}

export default ChatWindow
