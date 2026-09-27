import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { Redirect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import { Characters } from '@lib/state/Characters'
import { ContactMemory, Memories } from '@lib/state/Memories'
import { Theme } from '@lib/theme/ThemeManager'

const MemoriesScreen = () => {
    const { t } = useTranslation()
    const router = useRouter()
    const styles = useStyles()
    const { color } = Theme.useTheme()
    const { charId, charName } = Characters.useCharacterStore(
        useShallow((state) => ({
            charId: state.id,
            charName: state.card?.name,
        }))
    )
    const { data } = useLiveQuery(Memories.db.query.list(charId ?? -1), [charId])

    if (!charId) return <Redirect href=".." />

    const renderMemory = ({ item }: { item: ContactMemory }) => {
        const important = item.importance >= 75
        return (
            <View style={styles.memoryCard}>
                <View style={styles.memoryHeader}>
                    <View
                        style={[
                            styles.speakerBadge,
                            {
                                backgroundColor:
                                    item.speaker === 'user' ? '#07C16022' : '#576B9522',
                            },
                        ]}>
                        <Text
                            style={[
                                styles.speakerText,
                                {
                                    color: item.speaker === 'user' ? '#07A653' : '#576B95',
                                },
                            ]}>
                            {item.speaker === 'user' ? '我' : charName}
                        </Text>
                    </View>
                    {important && (
                        <View style={styles.importantBadge}>
                            <AntDesign name="star" size={12} color="#D98A00" />
                            <Text style={styles.importantText}>
                                {t('character.editor.memory.important')}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.time}>
                        {new Date(item.created_at).toLocaleDateString()}{' '}
                        {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </Text>
                </View>
                <Text style={styles.memoryContent}>{item.content}</Text>
            </View>
        )
    }

    return (
        <SafeAreaView edges={['bottom']} style={styles.container}>
            <HeaderTitle title={t('character.editor.memory.title')} />
            <HeaderButton
                headerLeft={() => (
                    <AntDesign
                        name="left"
                        size={22}
                        color={color.text._100}
                        onPress={() => router.back()}
                    />
                )}
            />
            <View style={styles.notice}>
                <AntDesign name="lock" size={16} color={color.text._400} />
                <Text style={styles.noticeText}>{t('character.editor.memory.readOnly')}</Text>
            </View>
            <FlatList
                data={data}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderMemory}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.empty}>{t('character.editor.memory.empty')}</Text>
                }
            />
        </SafeAreaView>
    )
}

export default MemoriesScreen

const useStyles = () => {
    const { color, spacing, fontSize, borderRadius } = Theme.useTheme()
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#EDEDED',
        },
        notice: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 8,
            marginHorizontal: spacing.l,
            marginTop: spacing.m,
            paddingHorizontal: spacing.m,
            paddingVertical: spacing.s,
            borderRadius: borderRadius.m,
            backgroundColor: '#FFFFFF',
        },
        noticeText: {
            flex: 1,
            color: color.text._400,
            fontSize: fontSize.s,
        },
        list: {
            padding: spacing.l,
            paddingBottom: spacing.xl3,
            rowGap: spacing.m,
        },
        memoryCard: {
            padding: spacing.l,
            borderRadius: borderRadius.m,
            backgroundColor: '#FFFFFF',
        },
        memoryHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.s,
        },
        speakerBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 4,
        },
        speakerText: {
            fontSize: fontSize.s,
            fontWeight: '600',
        },
        importantBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 3,
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 4,
            backgroundColor: '#FFF2CC',
        },
        importantText: {
            color: '#A76A00',
            fontSize: fontSize.s,
        },
        time: {
            flex: 1,
            textAlign: 'right',
            color: color.text._500,
            fontSize: fontSize.s,
        },
        memoryContent: {
            color: color.text._100,
            fontSize: fontSize.m,
            lineHeight: 22,
            marginTop: spacing.m,
        },
        empty: {
            color: color.text._500,
            textAlign: 'center',
            paddingTop: spacing.xl3,
        },
    })
}
