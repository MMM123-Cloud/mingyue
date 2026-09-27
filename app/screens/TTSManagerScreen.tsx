import * as Speech from 'expo-speech'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'

import ThemedButton from '@components/buttons/ThemedButton'
import DropdownSheet from '@components/input/DropdownSheet'
import ThemedSlider from '@components/input/ThemedSlider'
import ThemedSwitch from '@components/input/ThemedSwitch'
import ThemedTextInput from '@components/input/ThemedTextInput'
import SectionTitle from '@components/text/SectionTitle'
import HeaderTitle from '@components/views/HeaderTitle'
import { Logger } from '@lib/state/Logger'
import { useTTSStore } from '@lib/state/TTS'
import { Theme } from '@lib/theme/ThemeManager'
import { groupBy } from '@lib/utils/Array'

type LanguageListItem = {
    [key: string]: Speech.Voice[]
}

const TTSManagerScreen = () => {
    const { t } = useTranslation()
    const { color } = Theme.useTheme()
    const {
        voice,
        setVoice,
        enabled,
        setEnabled,
        auto,
        setAuto,
        rate,
        setRate,
        liveTTS,
        setLiveTTS,
    } = useTTSStore()
    const [lang, setLang] = useState(voice?.language ?? 'en-US')
    const [modelList, setModelList] = useState<Speech.Voice[]>([])
    const languageList: LanguageListItem = groupBy(modelList, 'language')
    const [testAudioText, setTestAudioText] = useState(t('tts.test'))
    const voiceCount = modelList.filter((item) => item.language === lang).length

    const languages = Object.keys(languageList)
        .sort()
        .map((name) => {
            return name
        })

    const getVoices = () => {
        Speech.getAvailableVoicesAsync().then((list) => setModelList(list))
    }
    useEffect(() => {
        getVoices()
    }, [])

    return (
        <KeyboardAwareScrollView
            style={{
                marginVertical: 16,
                paddingVertical: 16,
                paddingHorizontal: 16,
            }}
            contentContainerStyle={{ rowGap: 8 }}>
            <HeaderTitle title="语音朗读" />
            <View
                style={{
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: color.neutral._200,
                }}>
                <Text style={{ color: color.text._300, lineHeight: 20 }}>
                    这是让 AI 把回复读出来的功能。平时不用朗读，保持关闭即可。
                </Text>
            </View>
            <SectionTitle>朗读设置</SectionTitle>

            <ThemedSwitch
                label="打开语音朗读"
                value={enabled}
                onChangeValue={(value) => {
                    if (value) {
                        getVoices()
                    } else Speech.stop()
                    setEnabled(value)
                }}
            />
            <ThemedSwitch
                value={auto}
                onChangeValue={(value) => {
                    if (value) {
                        setLiveTTS(false)
                    }
                    setAuto(value)
                }}
                label="回复完成后自动朗读"
            />

            <ThemedSwitch
                value={liveTTS}
                onChangeValue={(value) => {
                    if (value) {
                        setAuto(false)
                    }
                    setLiveTTS(value)
                }}
                label="生成回复时同步朗读"
            />

            <ThemedSlider
                label="语速"
                min={0.1}
                max={2.5}
                step={0.1}
                precision={1}
                value={rate}
                onValueChange={setRate}
            />

            <SectionTitle style={{ marginTop: 8 }}>
                朗读语言 ({Object.keys(languageList).length})
            </SectionTitle>
            <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
                    <DropdownSheet
                        containerStyle={{ flex: 1 }}
                        selected={lang}
                        data={languages}
                        labelExtractor={(item) => item}
                        placeholder="选择语言"
                        onChangeValue={(item) => setLang(item)}
                    />
                    <ThemedButton
                        iconName="reload"
                        iconSize={20}
                        onPress={() => getVoices()}
                        variant="secondary"
                        label="刷新"
                    />
                </View>
            </View>

            <SectionTitle style={{ marginTop: 8 }}>可用声音 ({voiceCount})</SectionTitle>

            {voiceCount === 0 && (
                <Text style={{ color: color.text._400, lineHeight: 20 }}>
                    手机里没有这个语言的语音包，所以暂时选不了声音。可以先安装系统语音，再点上面的“刷新”。
                </Text>
            )}

            <DropdownSheet
                style={{ marginBottom: 8 }}
                search
                modalTitle="选择朗读声音"
                selected={voice}
                data={languageList?.[lang] ?? []}
                labelExtractor={(item) => item.identifier}
                placeholder="选择朗读声音"
                onChangeValue={(item) => setVoice(item)}
            />
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    columnGap: 8,
                    backgroundColor: color.neutral._100,
                }}>
                <ThemedTextInput
                    value={testAudioText}
                    onChangeText={setTestAudioText}
                    style={{ color: color.text._400, fontStyle: 'italic' }}
                />
                <ThemedButton
                    label="试听"
                    variant="secondary"
                    onPress={() => {
                        if (voice === undefined) {
                            Logger.warnToast('还没有选择可用声音')
                            return
                        }
                        Speech.speak(testAudioText, {
                            language: voice.language,
                            voice: voice.identifier,
                            rate: rate,
                        })
                    }}
                />
            </View>
        </KeyboardAwareScrollView>
    )
}

export default TTSManagerScreen
