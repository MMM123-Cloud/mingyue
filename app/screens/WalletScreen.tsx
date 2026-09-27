import AntDesign from '@react-native-vector-icons/ant-design/static'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import HeaderTitle from '@components/views/HeaderTitle'
import { useDeveloperModeStore } from '@lib/state/DeveloperMode'
import { useWalletStore } from '@lib/state/Wallet'
import { Theme } from '@lib/theme/ThemeManager'

const WalletScreen = () => {
    const { t } = useTranslation()
    const styles = useStyles()
    const { color } = Theme.useTheme()
    const developerMode = useDeveloperModeStore((state) => state.enabled)
    const { balance, records, recharge, resetWallet } = useWalletStore()

    return (
        <View style={styles.container}>
            <HeaderTitle title={t('navigation.wallet')} />
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>零钱（本地模拟）</Text>
                <Text style={styles.balance}>¥ {balance.toFixed(2)}</Text>
                <View style={styles.actions}>
                    {developerMode ? (
                        <TouchableOpacity style={styles.actionButton} onPress={recharge}>
                            <AntDesign name="plus" size={16} color={color.neutral._900} />
                            <Text style={styles.actionText}>开发者加钱 ¥1000（无限）</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.normalHint}>普通模式每月补贴 ¥10000，不能手动加钱</Text>
                    )}
                    <TouchableOpacity style={styles.resetButton} onPress={resetWallet}>
                        <Text style={styles.resetText}>重置</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.sectionTitle}>账单</Text>
            <FlatList
                data={records}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>还没有转账记录</Text>}
                renderItem={({ item }) => {
                    const isIncome = item.direction !== 'send'
                    const title =
                        item.direction === 'send'
                            ? `转给 ${item.characterName ?? 'AI'}`
                            : item.direction === 'receive'
                              ? `收到 ${item.characterName ?? 'AI'} 转账`
                              : item.direction === 'grant'
                                ? '每月虚拟补贴'
                                : item.direction === 'refund'
                                  ? '联系人注销退款'
                                  : '开发者模式加钱'
                    return (
                        <View style={styles.record}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.recordTitle}>{title}</Text>
                                <Text style={styles.recordNote}>
                                    {item.note || '无备注'} ·{' '}
                                    {new Date(item.createdAt).toLocaleString()}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.amount,
                                    { color: isIncome ? color.primary._600 : color.text._100 },
                                ]}>
                                {isIncome ? '+' : '-'}¥{item.amount.toFixed(2)}
                            </Text>
                        </View>
                    )
                }}
            />
        </View>
    )
}

export default WalletScreen

const useStyles = () => {
    const { color, spacing, fontSize, borderRadius } = Theme.useTheme()
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: color.neutral._100,
        },
        balanceCard: {
            margin: spacing.xl,
            padding: spacing.xl2,
            borderRadius: borderRadius.l,
            backgroundColor: color.primary._400,
        },
        balanceLabel: {
            color: color.neutral._900,
            fontSize: fontSize.m,
        },
        balance: {
            color: color.neutral._900,
            fontSize: 36,
            fontWeight: '700',
            marginTop: spacing.m,
        },
        actions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.xl2,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: spacing.s,
            paddingHorizontal: spacing.l,
            paddingVertical: spacing.m,
            borderRadius: borderRadius.m,
            backgroundColor: color.shadow,
        },
        actionText: {
            color: color.neutral._900,
            fontSize: fontSize.m,
        },
        resetButton: {
            paddingHorizontal: spacing.l,
            paddingVertical: spacing.m,
        },
        resetText: {
            color: color.neutral._900,
            fontSize: fontSize.m,
        },
        normalHint: {
            flex: 1,
            color: color.neutral._900,
            fontSize: fontSize.m,
            marginRight: spacing.m,
        },
        sectionTitle: {
            color: color.text._700,
            fontSize: fontSize.m,
            marginHorizontal: spacing.xl,
            marginBottom: spacing.m,
        },
        list: {
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl3,
        },
        empty: {
            color: color.text._500,
            textAlign: 'center',
            paddingTop: spacing.xl3,
        },
        record: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: color.neutral._200,
            padding: spacing.l,
            marginBottom: spacing.s,
            borderRadius: borderRadius.m,
            columnGap: spacing.m,
        },
        recordTitle: {
            color: color.text._100,
            fontSize: fontSize.l,
        },
        recordNote: {
            color: color.text._500,
            fontSize: fontSize.s,
            marginTop: spacing.xs,
        },
        amount: {
            fontSize: fontSize.l,
            fontWeight: '600',
        },
    })
}
