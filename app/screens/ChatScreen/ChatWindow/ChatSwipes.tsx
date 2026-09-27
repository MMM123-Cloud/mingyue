import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import React, { useCallback } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ChatSwipe } from '@db/schema'
import { Chats } from '@lib/state/Chat'
import { Theme } from '@lib/theme/ThemeManager'

type SwipesProps = {
    nowGenerating: boolean
    isGreeting: boolean
    swipe: ChatSwipe
}

const ChatSwipes: React.FC<SwipesProps> = ({ nowGenerating, isGreeting, swipe }) => {
    const styles = useStyles()
    const { color } = Theme.useTheme()
    const { data: swipeIdListData } = useLiveQuery(Chats.db.live.swipeIdList(swipe.entry_id), [])
    const swipeIdList = swipeIdListData.map((item) => item.id)

    const currentIndex = swipeIdList.indexOf(swipe.id)

    const getTextColor = useCallback(
        (b: boolean) => {
            return b ? color.text._600 : color.text._300
        },
        [color]
    )

    // Only greeting variants can be browsed. Regular replies never regenerate themselves.
    if (!isGreeting || !swipeIdList || currentIndex === -1 || swipeIdList.length <= 1) return

    const handleSwipeLeft = () => {
        if (currentIndex <= 0) return
        const newSwipeId = swipeIdList[currentIndex - 1]
        if (newSwipeId) Chats.db.mutate.activateSwipe(newSwipeId)
    }

    const handleSwipeRight = () => {
        if (currentIndex >= swipeIdList.length - 1) return
        const newSwipeId = swipeIdList[currentIndex + 1]
        if (newSwipeId) Chats.db.mutate.activateSwipe(newSwipeId)
    }

    const disableSwipeLeft = nowGenerating || currentIndex === 0
    const disableSwipeRight = nowGenerating || currentIndex >= swipeIdList.length - 1

    return (
        <View style={styles.swipesItem}>
            <TouchableOpacity
                style={styles.swipeButton}
                onPress={handleSwipeLeft}
                disabled={disableSwipeLeft}>
                <AntDesign name="left" size={20} color={getTextColor(disableSwipeLeft)} />
            </TouchableOpacity>

            <Text style={styles.swipeText}>
                {currentIndex + 1} / {swipeIdList.length}
            </Text>

            <TouchableOpacity
                style={styles.swipeButton}
                onPress={handleSwipeRight}
                disabled={disableSwipeRight}>
                <AntDesign name="right" size={20} color={getTextColor(disableSwipeRight)} />
            </TouchableOpacity>
        </View>
    )
}

export default ChatSwipes

const useStyles = () => {
    const { color, spacing } = Theme.useTheme()
    return StyleSheet.create({
        swipesItem: {
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            flex: 1,
            marginTop: spacing.sm,
            zIndex: 32,
        },

        swipeText: {
            color: color.text._200,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.m,
        },

        swipeButton: {
            alignItems: 'center',
            flex: 1,
            paddingVertical: spacing.sm,
        },
    })
}
