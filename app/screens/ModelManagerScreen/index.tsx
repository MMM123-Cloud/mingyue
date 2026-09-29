import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { useState } from 'react'
import { useSegments } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SectionList } from 'react-native'
import Animated, { Easing, SlideInLeft, SlideOutLeft } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import HorizontalSelector from '@components/input/HorizontalSelector'
import SectionTitle from '@components/text/SectionTitle'
import HeaderButton from '@components/views/HeaderButton'
import HeaderTitle from '@components/views/HeaderTitle'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { Model } from '@lib/engine/Local/Model'
import { Theme } from '@lib/theme/ThemeManager'

import ModelEmpty from './ModelEmpty'
import ModelInfoHeader from './ModelInfoHeader'
import ModelItem from './ModelItem'
import ModelNewMenu from './ModelNewMenu'
import ModelSettings from './ModelSettings'

const ModelManagerScreen = () => {
    const { t } = useTranslation()
    const { spacing } = Theme.useTheme()
    const inTabs = useSegments()[0] === '(tabs)'

    const { data: mmprojLinks } = useLiveQuery(Model.getMMPROJLinks())

    const { data: modelList, updatedAt: modelUpdatedAt } = useLiveQuery(
        Model.getModelListQuery2(),
        [mmprojLinks]
    )
    const { data: mmprojList } = useLiveQuery(Model.getMMPROJListQuery())

    const [showSettings, setShowSettings] = useState(false)
    const [modelLoading, setModelLoading] = useState(false)
    const [modelImporting, setModelImporting] = useState(false)

    const { setloadProgress } = Llama.useLlamaModelStore(
        useShallow((state) => ({
            setloadProgress: state.setLoadProgress,
        }))
    )

    const data = [
        {
            title: t('model.title'),
            data: modelList ?? [],
        },
        {
            title: t('model.mtmd'),
            data: mmprojList ?? [],
        },
    ]

    return (
        <SafeAreaView
            edges={inTabs ? [] : ['bottom']}
            style={{
                paddingTop: spacing.xl,
                paddingHorizontal: spacing.xl,
                paddingBottom: 8,
                flex: 1,
            }}>
            <HeaderTitle title={showSettings ? t('model.settings.title') : t('model.title')} />
            <HeaderButton
                headerRight={() =>
                    !showSettings && (
                        <ModelNewMenu
                            modelImporting={modelImporting}
                            setModelImporting={setModelImporting}
                        />
                    )
                }
            />

            <HorizontalSelector
                style={{ flex: 0, marginBottom: 16 }}
                values={[
                    { label: t('model.title'), value: false },
                    { label: t('common.navigation.settings'), value: true },
                ]}
                selected={showSettings}
                onPress={setShowSettings}
            />

            {!showSettings && (
                <Animated.View
                    style={{ flex: 1 }}
                    entering={SlideInLeft.easing(Easing.inOut(Easing.cubic))}
                    exiting={SlideOutLeft.easing(Easing.inOut(Easing.cubic))}>
                    <SectionList
                        ListHeaderComponent={
                            <ModelInfoHeader
                                modelImporting={modelImporting}
                                modelLoading={modelLoading}
                                modelListLength={modelList.length}
                                modelUpdatedAt={modelUpdatedAt}
                            />
                        }
                        style={{
                            marginTop: 16,
                            flex: 1,
                        }}
                        sections={data}
                        renderItem={({ item }) => (
                            <ModelItem
                                item={item}
                                mmprojList={mmprojList}
                                modelLoading={modelLoading}
                                setModelLoading={(b: boolean) => {
                                    if (b) setloadProgress(0)
                                    setModelLoading(b)
                                }}
                                modelImporting={modelImporting}
                            />
                        )}
                        renderSectionHeader={({ section: { title, data } }) => {
                            if (mmprojList.length > 0)
                                return (
                                    <SectionTitle
                                        visible={data.length > 0}
                                        style={{ marginBottom: 16 }}>
                                        {title}
                                    </SectionTitle>
                                )
                            return <></>
                        }}
                        keyExtractor={(item) => item.id.toString()}
                        removeClippedSubviews={false}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={() => <ModelEmpty />}
                    />
                </Animated.View>
            )}

            {showSettings && (
                <ModelSettings
                    modelImporting={modelImporting}
                    modelLoading={modelLoading}
                    exit={() => setShowSettings(false)}
                />
            )}
        </SafeAreaView>
    )
}

export default ModelManagerScreen
