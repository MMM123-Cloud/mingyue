import AntDesign from '@react-native-vector-icons/ant-design/static'
import { eq } from 'drizzle-orm'
import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { useRouter, useSegments } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import ThemedButton from '@components/buttons/ThemedButton'
import Avatar from '@components/views/Avatar'
import { useBottomSheetRef } from '@components/views/BottomSheet'
import ContextMenu from '@components/views/ContextMenu'
import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import InputSheet from '@components/views/InputSheet'
import { db as database } from '@db/db'
import { characters } from '@db/schema'
import { Characters } from '@lib/state/Characters'
import { Logger } from '@lib/state/Logger'
import {
    SOCIAL_LOCATIONS,
    SocialActor,
    SocialCharacterSeed,
    SocialLocation,
    SocialPost,
    SocialPostVisibility,
    useSocialStore,
} from '@lib/state/Social'
import { withAlpha } from '@lib/theme/ThemeColor'
import { Theme } from '@lib/theme/ThemeManager'
import { getFriendlyTimeStamp } from '@lib/utils/Time'

const POST_VISIBILITY_OPTIONS: { value: SocialPostVisibility; label: string }[] = [
    { value: 'public', label: '公开' },
    { value: 'selected', label: '指定联系人' },
    { value: 'private', label: '仅自己' },
]

const SocialScreen = () => {
    const router = useRouter()
    const inTabs = useSegments()[0] === '(tabs)'
    const styles = useStyles()
    const { color } = Theme.useTheme()
    const postSheetRef = useBottomSheetRef()
    const commentSheetRef = useBottomSheetRef()
    const [selectedLocation, setSelectedLocation] = useState<SocialLocation | undefined>()
    const [commentPostId, setCommentPostId] = useState<string | undefined>()
    const [postVisibility, setPostVisibility] = useState<SocialPostVisibility>('public')
    const [visibleTo, setVisibleTo] = useState<number[]>([])

    const userCard = Characters.useUserStore((state) => state.card)
    const { data: characterRows } = useLiveQuery(
        database
            .select({
                id: characters.id,
                name: characters.name,
                image_id: characters.image_id,
                personality: characters.personality,
                description: characters.description,
                deleted_at: characters.deleted_at,
            })
            .from(characters)
            .where(eq(characters.type, 'character')),
        []
    )

    const seeds: SocialCharacterSeed[] = useMemo(
        () =>
            characterRows
                .filter((item) => !item.deleted_at)
                .map((item) => ({
                    id: item.id,
                    name: item.name,
                    imageId: item.image_id,
                    personality: item.personality,
                    description: item.description,
                })),
        [characterRows]
    )

    const userActor: SocialActor = useMemo(
        () => ({
            type: 'user',
            id: userCard?.id ?? -1,
            name: userCard?.name?.trim() || '我',
            imageId: userCard?.image_id,
        }),
        [userCard]
    )

    const posts = useSocialStore((state) => state.posts)
    const lives = useSocialStore((state) => state.lives)
    const syncCharacters = useSocialStore((state) => state.syncCharacters)
    const tick = useSocialStore((state) => state.tick)
    const publishPost = useSocialStore((state) => state.publishPost)
    const toggleLike = useSocialStore((state) => state.toggleLike)
    const addComment = useSocialStore((state) => state.addComment)
    const introduceByCard = useSocialStore((state) => state.introduceByCard)

    useEffect(() => {
        if (seeds.length === 0) return
        syncCharacters(seeds)
        tick(seeds)
    }, [seeds, syncCharacters, tick])

    const openCompose = (location?: SocialLocation) => {
        setSelectedLocation(location)
        postSheetRef.current?.open()
    }

    const openComment = (postId: string) => {
        setCommentPostId(postId)
        commentSheetRef.current?.open()
    }

    const getPostVisibilityLabel = (post: SocialPost) => {
        if (post.author.type !== 'user') return undefined
        if (post.visibility === 'private') return '仅自己可见'
        if (post.visibility === 'selected') {
            const names = (post.visibleTo ?? [])
                .map((id) => seeds.find((item) => item.id === id)?.name)
                .filter((name): name is string => !!name)
            return names.length > 0 ? `仅 ${names.join('、')} 可见` : '仅自己可见'
        }
        return '公开'
    }

    const toggleVisibleContact = (characterId: number) => {
        setVisibleTo((current) =>
            current.includes(characterId)
                ? current.filter((id) => id !== characterId)
                : [...current, characterId]
        )
    }

    const handleIntroduceByCard = (fromId: number, toId: number) => {
        const message = introduceByCard(userActor, fromId, toId, seeds)
        if (message) Logger.infoToast(message)
        else Logger.warnToast('这两个联系人已经在你的通讯录里了')
    }

    const renderPost = ({ item }: { item: SocialPost }) => {
        const liked = item.likes.some(
            (like) => like.actor.type === userActor.type && like.actor.id === userActor.id
        )
        return (
            <View style={styles.post}>
                <View style={styles.postHeader}>
                    <Avatar
                        style={styles.postAvatar}
                        targetImage={Characters.getImageDir(item.author.imageId ?? -1)}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.postName}>{item.author.name}</Text>
                        <Text style={styles.postTime}>{getFriendlyTimeStamp(item.createdAt)}</Text>
                    </View>
                </View>

                <Text style={styles.postContent}>{item.content}</Text>

                {item.location && (
                    <View style={styles.location}>
                        <AntDesign name="environment" size={14} color={color.primary._700} />
                        <Text style={styles.locationText}>{item.location.name}</Text>
                    </View>
                )}

                {getPostVisibilityLabel(item) && (
                    <View style={styles.visibility}>
                        <AntDesign name="eye" size={13} color={color.text._500} />
                        <Text style={styles.visibilityText}>{getPostVisibilityLabel(item)}</Text>
                    </View>
                )}

                {(item.likes.length > 0 || item.comments.length > 0) && (
                    <View style={styles.interactions}>
                        {item.likes.length > 0 && (
                            <Text style={styles.likes}>
                                <AntDesign name="heart" size={13} color={color.primary._700} />{' '}
                                {item.likes.map((like) => like.actor.name).join('，')}
                            </Text>
                        )}
                        {item.comments.map((comment) => (
                            <Text key={comment.id} style={styles.comment}>
                                <Text style={styles.commentName}>{comment.actor.name}：</Text>
                                {comment.content}
                            </Text>
                        ))}
                    </View>
                )}

                <View style={styles.postActions}>
                    <TouchableOpacity
                        style={styles.action}
                        onPress={() => toggleLike(item.id, userActor)}>
                        <AntDesign
                            name="heart"
                            size={20}
                            color={liked ? '#D84343' : color.text._500}
                        />
                        <Text style={styles.actionText}>{liked ? '取消' : '赞'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.action} onPress={() => openComment(item.id)}>
                        <AntDesign name="message" size={20} color={color.text._500} />
                        <Text style={styles.actionText}>评论</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    const profileHeader = () => (
        <View>
            <View style={styles.profile}>
                <Avatar
                    style={styles.profileAvatar}
                    targetImage={Characters.getImageDir(userCard?.image_id ?? -1)}
                />
                <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{userActor.name}</Text>
                    <Text style={styles.profileIntro} numberOfLines={2}>
                        {userCard?.description?.trim() || '介绍一下自己，联系人会看到。'}
                    </Text>
                </View>
            </View>

            {seeds.length > 0 && (
                <View style={styles.lifeSection}>
                    <Text style={styles.sectionTitle}>联系人的此刻</Text>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={seeds}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={{ columnGap: 12 }}
                        renderItem={({ item }) => {
                            const life = lives[String(item.id)]
                            if (!life) return null
                            return (
                                <View style={styles.lifeItem}>
                                    <View style={styles.lifeTop}>
                                        <Avatar
                                            style={styles.lifeAvatar}
                                            targetImage={Characters.getImageDir(item.imageId ?? -1)}
                                        />
                                        <Text style={styles.lifeName} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                    </View>
                                    <Text style={styles.lifeActivity} numberOfLines={2}>
                                        {life.currentActivity}
                                    </Text>
                                    <Text style={styles.lifeLocation} numberOfLines={1}>
                                        {life.location.name}
                                    </Text>
                                </View>
                            )
                        }}
                    />
                </View>
            )}
        </View>
    )

    return (
        <SafeAreaView edges={inTabs ? [] : ['bottom']} style={styles.container}>
            <HeaderTitle title="动态" />
            <HeaderButton
                headerLeft={
                    inTabs
                        ? undefined
                        : () => (
                              <ThemedButton
                                  iconName="left"
                                  variant="tertiary"
                                  iconSize={22}
                                  onPress={() => router.back()}
                              />
                          )
                }
                headerRight={() => (
                    <ContextMenu
                        accessibilityLabel="发表动态或推荐联系人"
                        placement="bottom"
                        triggerIcon="plus"
                        buttons={[
                            {
                                label: '发表动态',
                                icon: 'edit',
                                onPress: (close) => {
                                    close()
                                    openCompose()
                                },
                            },
                            {
                                label: '带定位发表',
                                icon: 'environment',
                                submenu: SOCIAL_LOCATIONS.slice(0, 8).map((location) => ({
                                    label: location.name,
                                    icon: 'environment',
                                    onPress: (close) => {
                                        close()
                                        openCompose(location)
                                    },
                                })),
                            },
                            {
                                label: '推荐名片',
                                icon: 'idcard',
                                submenu:
                                    seeds.length < 2
                                        ? [
                                              {
                                                  label: '需要至少两个联系人',
                                                  icon: 'info-circle',
                                                  disabled: true,
                                              },
                                          ]
                                        : seeds.map((from) => ({
                                              label: `${from.name} 的名片`,
                                              icon: 'user',
                                              submenu: seeds
                                                  .filter((to) => to.id !== from.id)
                                                  .map((to) => ({
                                                      label: `推荐给 ${to.name}`,
                                                      icon: 'user-add',
                                                      onPress: (close) => {
                                                          close()
                                                          handleIntroduceByCard(from.id, to.id)
                                                      },
                                                  })),
                                          })),
                            },
                        ]}
                    />
                )}
            />

            <InputSheet
                ref={postSheetRef}
                title={selectedLocation ? `发表动态 · ${selectedLocation.name}` : '发表动态'}
                placeholder="这一刻的想法……"
                confirmLabel="发表"
                multiline
                autoFocus
                verifyText={(text) => {
                    if (!text.trim()) return '请输入动态内容'
                    if (postVisibility === 'selected' && visibleTo.length === 0)
                        return '请至少选择一位可见联系人'
                    return ''
                }}
                onConfirm={(text) => {
                    publishPost(userActor, text, selectedLocation, seeds, {
                        visibility: postVisibility,
                        visibleTo,
                    })
                }}
                onClose={() => {
                    setSelectedLocation(undefined)
                    setPostVisibility('public')
                    setVisibleTo([])
                }}>
                <View style={styles.visibilityPanel}>
                    <Text style={styles.visibilityTitle}>谁可以看</Text>
                    <View style={styles.visibilityOptions}>
                        {POST_VISIBILITY_OPTIONS.map((option) => {
                            const selected = postVisibility === option.value
                            return (
                                <Pressable
                                    key={option.value}
                                    onPress={() => setPostVisibility(option.value)}
                                    style={[
                                        styles.visibilityOption,
                                        selected && styles.visibilityOptionSelected,
                                    ]}>
                                    <Text
                                        style={[
                                            styles.visibilityOptionText,
                                            selected && styles.visibilityOptionTextSelected,
                                        ]}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            )
                        })}
                    </View>

                    {postVisibility === 'selected' && (
                        <View style={styles.contactOptions}>
                            {seeds.map((character) => {
                                const selected = visibleTo.includes(character.id)
                                return (
                                    <Pressable
                                        key={character.id}
                                        onPress={() => toggleVisibleContact(character.id)}
                                        style={[
                                            styles.contactOption,
                                            selected && styles.contactOptionSelected,
                                        ]}>
                                        <Text
                                            style={[
                                                styles.contactOptionText,
                                                selected && styles.contactOptionTextSelected,
                                            ]}>
                                            {character.name}
                                        </Text>
                                    </Pressable>
                                )
                            })}
                        </View>
                    )}
                </View>
            </InputSheet>

            <InputSheet
                ref={commentSheetRef}
                title="评论"
                placeholder="说点什么……"
                confirmLabel="发送"
                autoFocus
                onConfirm={(text) => {
                    if (commentPostId) addComment(commentPostId, userActor, text, seeds)
                }}
                onClose={() => setCommentPostId(undefined)}
            />

            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={renderPost}
                ListHeaderComponent={profileHeader}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.empty}>还没有动态，联系人稍后会自己出现在这里。</Text>
                }
            />
        </SafeAreaView>
    )
}

export default SocialScreen

const useStyles = () => {
    const { color, spacing, fontSize, borderRadius } = Theme.useTheme()
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        list: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: spacing.xl3,
        },
        profile: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.l,
            padding: spacing.xl,
            backgroundColor: color.neutral._200,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: withAlpha(color.neutral._400, '80'),
        },
        profileAvatar: {
            width: 60,
            height: 60,
            borderRadius: 16,
        },
        profileName: {
            color: color.text._100,
            fontSize: 21,
            fontWeight: '600',
        },
        profileIntro: {
            color: color.text._500,
            fontSize: fontSize.m,
            marginTop: 4,
        },
        lifeSection: {
            paddingTop: spacing.xl,
            paddingBottom: spacing.m,
            marginTop: spacing.l,
            borderRadius: 24,
            backgroundColor: withAlpha(color.neutral._200, 'B8'),
            borderColor: color.neutral._400,
            borderWidth: 1,
        },
        sectionTitle: {
            color: color.text._500,
            fontSize: fontSize.m,
            marginHorizontal: spacing.xl,
            marginBottom: spacing.m,
        },
        lifeItem: {
            width: 148,
            minHeight: 128,
            padding: spacing.m,
            marginLeft: spacing.xl,
            borderRadius: 16,
            backgroundColor: color.neutral._300,
        },
        lifeTop: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.s,
        },
        lifeAvatar: {
            width: 30,
            height: 30,
            borderRadius: 6,
        },
        lifeName: {
            flex: 1,
            color: color.text._100,
            fontWeight: '600',
        },
        lifeActivity: {
            color: color.text._200,
            fontSize: fontSize.s,
            marginTop: spacing.m,
        },
        lifeLocation: {
            color: color.primary._700,
            fontSize: fontSize.s,
            marginTop: spacing.m,
        },
        visibility: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 4,
            marginTop: spacing.s,
        },
        visibilityText: {
            color: color.text._500,
            fontSize: fontSize.s,
        },
        visibilityPanel: {
            rowGap: spacing.m,
            padding: spacing.m,
            backgroundColor: withAlpha(color.neutral._200, 'B8'),
            borderRadius: 16,
        },
        visibilityTitle: {
            color: color.text._300,
            fontSize: fontSize.s,
        },
        visibilityOptions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: spacing.s,
            rowGap: spacing.s,
        },
        visibilityOption: {
            paddingHorizontal: spacing.m,
            paddingVertical: spacing.s,
            borderWidth: 1,
            borderColor: color.neutral._400,
            borderRadius: 16,
        },
        visibilityOptionSelected: {
            backgroundColor: color.primary._300,
            borderColor: color.primary._700,
        },
        visibilityOptionText: {
            color: color.text._500,
            fontSize: fontSize.s,
        },
        visibilityOptionTextSelected: {
            color: color.text._100,
            fontWeight: '600',
        },
        contactOptions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: spacing.s,
            rowGap: spacing.s,
        },
        contactOption: {
            paddingHorizontal: spacing.m,
            paddingVertical: spacing.s,
            backgroundColor: color.neutral._300,
            borderRadius: 16,
        },
        contactOptionSelected: {
            backgroundColor: color.primary._500,
        },
        contactOptionText: {
            color: color.text._300,
            fontSize: fontSize.s,
        },
        contactOptionTextSelected: {
            color: color.text._100,
            fontWeight: '600',
        },
        post: {
            backgroundColor: withAlpha(color.neutral._200, 'B8'),
            marginTop: spacing.l,
            padding: spacing.xl,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: withAlpha(color.neutral._400, '80'),
        },
        postHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.l,
        },
        postAvatar: {
            width: 42,
            height: 42,
            borderRadius: 6,
        },
        postName: {
            color: color.primary._700,
            fontSize: fontSize.l,
            fontWeight: '600',
        },
        postTime: {
            color: color.text._500,
            fontSize: fontSize.s,
            marginTop: 2,
        },
        postContent: {
            color: color.text._100,
            fontSize: fontSize.l,
            lineHeight: 24,
            marginTop: spacing.l,
        },
        location: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 4,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 4,
            backgroundColor: color.neutral._300,
            marginTop: spacing.m,
        },
        locationText: {
            color: color.primary._700,
            fontSize: fontSize.s,
        },
        interactions: {
            marginTop: spacing.l,
            padding: spacing.m,
            borderRadius: 4,
            backgroundColor: color.neutral._300,
        },
        likes: {
            color: color.primary._700,
            fontSize: fontSize.s,
            lineHeight: 20,
        },
        comment: {
            color: color.text._100,
            fontSize: fontSize.s,
            lineHeight: 20,
            marginTop: 4,
        },
        commentName: {
            color: color.primary._700,
            fontWeight: '600',
        },
        postActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            columnGap: 24,
            marginTop: spacing.l,
            paddingTop: spacing.m,
            borderTopWidth: 1,
            borderColor: color.neutral._400,
        },
        action: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 4,
        },
        actionText: {
            color: color.text._500,
            fontSize: fontSize.m,
        },
        empty: {
            textAlign: 'center',
            color: color.text._500,
            paddingTop: spacing.xl3,
        },
    })
}
