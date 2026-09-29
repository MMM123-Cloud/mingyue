import AntDesign from '@react-native-vector-icons/ant-design/static'
import { Text, View } from 'react-native'

import { Theme } from '@lib/theme/ThemeManager'

export default function LiquidEmpty() {
    const { color } = Theme.useTheme()
    return (
        <View
            style={{
                paddingVertical: 28,
                paddingHorizontal: 24,
                alignItems: 'center',
                gap: 10,
                backgroundColor: color.neutral._200,
                borderRadius: 20,
            }}>
            <View
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: color.primary._100,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                <AntDesign
                    accessible={false}
                    name="user-add"
                    color={color.primary._700}
                    size={22}
                />
            </View>
            <Text style={{ color: color.text._200, fontSize: 16, fontWeight: '500' }}>
                还没有联系人
            </Text>
            <Text
                style={{
                    color: color.text._400,
                    fontSize: 13,
                    lineHeight: 21,
                    textAlign: 'center',
                }}>
                添加一个角色，开始属于你的对话。
            </Text>
        </View>
    )
}
