const IS_DEV = process.env.APP_VARIANT === 'development'

module.exports = {
    expo: {
        name: IS_DEV ? '明月 (DEV)' : '明月',
        newArchEnabled: true,
        slug: 'mingyue-ai',
        version: '0.10.29',
        orientation: 'default',
        icon: './assets/images/icon.png',
        scheme: 'mingyue',
        userInterfaceStyle: 'dark',
        assetBundlePatterns: ['**/*'],
        ios: {
            icon: {
                dark: './assets/images/ios-dark.png',
                light: './assets/images/ios-light.png',
                tinted: './assets/images/icon.png',
            },
            supportsTablet: true,
            package: IS_DEV ? 'com.zjf20.mingyue.dev' : 'com.zjf20.mingyue',
            bundleIdentifier: IS_DEV ? 'com.zjf20.mingyue.dev' : 'com.zjf20.mingyue',
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/images/adaptive-icon-foreground.png',
                backgroundImage: './assets/images/adaptive-icon-background.png',
                monochromeImage: './assets/images/adaptive-icon-foreground.png',
                backgroundColor: '#000',
            },
            package: IS_DEV ? 'com.zjf20.mingyue.dev' : 'com.zjf20.mingyue',
            userInterfaceStyle: 'dark',
            permissions: [
                'android.permission.FOREGROUND_SERVICE',
                'android.permission.WAKE_LOCK',
                'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
            ],
        },
        web: {
            bundler: 'metro',
            output: 'static',
            favicon: './assets/images/adaptive-icon.png',
        },
        plugins: [
            [
                'expo-asset',
                {
                    assets: ['./assets/models/aibot.raw', './assets/models/llama3tokenizer.gguf'],
                },
            ],
            [
                'expo-build-properties',
                {
                    android: {
                        largeHeap: true,
                        usesCleartextTraffic: true,
                        enableProguardInReleaseBuilds: true,
                        enableShrinkResourcesInReleaseBuilds: true,
                        useLegacyPackaging: true,
                        extraProguardRules:
                            '-keep class com.rnllama.** { *; }\n-keep class com.margelo.nitro.mmkv.NitroMmkvOnLoad { *; }',
                    },
                },
            ],
            [
                'expo-splash-screen',
                {
                    backgroundColor: '#090B0A',
                    image: './assets/images/adaptive-icon.png',
                    imageWidth: 200,
                },
            ],
            [
                'expo-notifications',
                {
                    icon: './assets/images/notification.png',
                },
            ],
            [
                './expo-build-plugins/androidattributes.plugin.js',
                {
                    'android:largeHeap': true,
                },
            ],
            ['@vali98/react-native-process-text', { label: 'Ask In MingYue' }],
            ['expo-sqlite', { withSQLiteVecExtension: true }],
            'expo-localization',
            'expo-router',
            'expo-font',
            'expo-image',
            './expo-build-plugins/bgactions.plugin.js',
            './expo-build-plugins/usercert.plugin.js',
            './expo-build-plugins/rnllama.plugin.js',
            './expo-build-plugins/copyhtp.plugin.js',
            /**
             * Future icon usage will need to be added here
             * https://github.com/oblador/react-native-vector-icons/blob/master/docs/SETUP-EXPO.md
             */
            '@react-native-vector-icons/ant-design',
            '@react-native-vector-icons/octicons',
            '@react-native-vector-icons/material-icons',
        ],
        experiments: {
            typedRoutes: true,
            reactCompiler: true,
        },
        extra: {
            router: {
                origin: false,
            },
            eas: {
                projectId: 'd588a96a-5eb0-457a-85bc-e21acfdc60e9',
            },
        },
    },
}
