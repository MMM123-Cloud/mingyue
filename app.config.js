const IS_DEV = process.env.APP_VARIANT === 'development'

module.exports = {
    expo: {
        name: IS_DEV ? '明月 (DEV)' : '明月',
        newArchEnabled: true,
        slug: 'mingyue-ai',
        version: '0.12.0',
        orientation: 'default',
        icon: './assets/images/liquid-icon.png',
        scheme: 'mingyue',
        userInterfaceStyle: 'light',
        assetBundlePatterns: ['**/*'],
        ios: {
            icon: {
                dark: './assets/images/liquid-icon.png',
                light: './assets/images/liquid-icon.png',
                tinted: './assets/images/liquid-icon.png',
            },
            supportsTablet: true,
            package: IS_DEV ? 'com.zjf20.mingyue.dev' : 'com.zjf20.mingyue.glass',
            bundleIdentifier: IS_DEV ? 'com.zjf20.mingyue.dev' : 'com.zjf20.mingyue',
        },
        android: {
            versionCode: 12000,
            adaptiveIcon: {
                foregroundImage: './assets/images/liquid-icon-foreground.png',
                monochromeImage: './assets/images/liquid-icon-foreground.png',
                backgroundColor: '#F6F8FC',
            },
            package: IS_DEV ? 'com.zjf20.mingyue.dev' : 'com.zjf20.mingyue.glass',
            userInterfaceStyle: 'light',
            permissions: [
                'android.permission.FOREGROUND_SERVICE',
                'android.permission.WAKE_LOCK',
                'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
            ],
        },
        web: {
            bundler: 'metro',
            output: 'static',
            favicon: './assets/images/liquid-icon.png',
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
                    backgroundColor: '#F6F8FC',
                    image: './assets/images/liquid-icon-foreground.png',
                    imageWidth: 144,
                },
            ],
            [
                'expo-notifications',
                {
                    icon: './assets/images/liquid-icon-foreground.png',
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
            './expo-build-plugins/nativebuild.plugin.js',
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
        },
    },
}
