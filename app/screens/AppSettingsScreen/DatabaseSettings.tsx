import { reloadAppAsync } from 'expo'
import { getDocumentAsync } from 'expo-document-picker'
import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import appConfig from '@appconfig'
import ThemedButton from '@components/buttons/ThemedButton'
import SectionTitle from '@components/text/SectionTitle'
import Alert from '@components/views/Alert'
import { migrateData } from '@db/dataMigrations'
import { Llama } from '@lib/engine/Local/LlamaLocal'
import { Logger } from '@lib/state/Logger'
import { useInference } from '@lib/state/Chat'
import { Theme } from '@lib/theme/ThemeManager'
import { exportDatabaseSnapshot, importDatabaseSnapshot } from '@lib/utils/DatabaseBackup'
import { downloadLocalFile } from '@lib/utils/Download'

const appVersion = appConfig.expo.version

export default function DatabaseSettings() {
    const { t } = useTranslation()
    const { color } = Theme.useTheme()
    const [busy, setBusy] = useState(false)
    const lock = useRef(false)
    const run = async (operation: () => Promise<void>) => {
        if (lock.current) return
        const model = Llama.useLlamaModelStore.getState()
        if (model.generating || model.loading || useInference.getState().nowGenerating) {
            Logger.errorToast('请先等待模型加载或对话完成。')
            return
        }
        lock.current = true
        setBusy(true)
        try {
            await operation()
        } catch (error) {
            Logger.errorToast('备份操作未完成', error)
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    const exportDB = () =>
        run(async () => {
            const uri = await exportDatabaseSnapshot(appVersion)
            if (await downloadLocalFile(uri))
                Logger.infoToast(t('settings.database.toast.downloadOk'))
        })
    const importDB = (uri: string) =>
        run(async () => {
            await importDatabaseSnapshot(uri)
            await reloadAppAsync()
        })
    const chooseBackup = async () => {
        try {
            const result = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
            if (result.canceled) return
            const asset = result.assets[0]
            const differentVersion = asset.name.split('-')[0] !== appVersion
            Alert.alert({
                title: '导入数据库备份',
                description:
                    '将恢复备份中的联系人和角色聊天。系统会先验证文件并保存当前数据库的恢复副本。' +
                    (differentVersion ? '此备份的版本可能不同，请确认来源。' : ''),
                buttons: [
                    { label: t('common.actions.cancel') },
                    { label: '验证并导入', type: 'warning', onPress: () => importDB(asset.uri) },
                ],
            })
        } catch (error) {
            Logger.errorToast('无法打开备份文件', error)
        }
    }
    return (
        <View style={{ gap: 12 }}>
            <SectionTitle>{t('settings.database.title')}</SectionTitle>
            <Text style={{ color: color.text._300, lineHeight: 22, marginBottom: 8 }}>
                保存联系人和角色聊天的数据库快照。直接对话可在聊天页右上角另行导出；应用设置和模型文件不在此备份中。
            </Text>
            <ThemedButton
                disabled={busy}
                label={busy ? '正在处理…' : t('settings.database.exportButton')}
                variant="secondary"
                onPress={exportDB}
            />
            <ThemedButton
                disabled={busy}
                label={t('settings.database.importButton')}
                variant="secondary"
                onPress={chooseBackup}
            />
            <ThemedButton
                disabled={busy}
                label={t('settings.database.rerunMigrationsButton')}
                variant="secondary"
                onPress={() =>
                    Alert.alert({
                        title: t('settings.database.alert.rerunMigrations.title'),
                        description: t('settings.database.alert.rerunMigrations.description'),
                        buttons: [
                            { label: t('common.actions.cancel') },
                            {
                                label: t('settings.database.alert.rerunMigrations.confirm'),
                                type: 'warning',
                                onPress: () => run(() => migrateData({ bypass: true })),
                            },
                        ],
                    })
                }
            />
        </View>
    )
}
