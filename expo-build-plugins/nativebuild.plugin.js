const { withProjectBuildGradle, withGradleProperties } = require('expo/config-plugins')

// Gradle's worker limit alone does not limit each Ninja subprocess.
// https://cmake.org/cmake/help/latest/prop_gbl/JOB_POOLS.html
module.exports = function withBoundedNativeBuild(config) {
    config = withGradleProperties(config, (config) => {
        const limits = {
            'org.gradle.workers.max': '1',
            'org.gradle.parallel': 'false',
            'org.gradle.jvmargs': '-Xmx3072m -Xms128m -XX:MaxMetaspaceSize=768m',
            'kotlin.compiler.execution.strategy': 'in-process',
        }
        config.modResults = config.modResults.filter(
            (entry) => entry.type !== 'property' || !(entry.key in limits)
        )
        for (const [key, value] of Object.entries(limits)) {
            config.modResults.push({ type: 'property', key, value })
        }
        return config
    })
    return withProjectBuildGradle(config, (config) => {
        if (!config.modResults.contents.includes('// MINGYUE_APP_BUILD_DIRECTORY')) {
            const directoryOverride = `
// MINGYUE_APP_BUILD_DIRECTORY
def mingyueAppBuildDirectory = System.getenv("MINGYUE_APP_BUILD_DIRECTORY")
if (mingyueAppBuildDirectory) {
    subprojects { subproject ->
        subproject.plugins.withId("com.android.application") {
            subproject.layout.buildDirectory.set(file(mingyueAppBuildDirectory))
        }
    }
}
`
            config.modResults.contents = config.modResults.contents.replace(
                'apply plugin: "expo-root-project"',
                directoryOverride + '\napply plugin: "expo-root-project"'
            )
        }
        if (!config.modResults.contents.includes('// MINGYUE_BOUNDED_NATIVE_BUILD')) {
            const boundedBuild = `
// MINGYUE_BOUNDED_NATIVE_BUILD
subprojects { subproject ->
    ["com.android.library", "com.android.application"].each { pluginId ->
        subproject.plugins.withId(pluginId) {
            subproject.android.defaultConfig.externalNativeBuild.cmake.arguments.addAll([
                "-DCMAKE_JOB_POOLS=mingyue_compile=2;mingyue_link=1",
                "-DCMAKE_JOB_POOL_COMPILE=mingyue_compile",
                "-DCMAKE_JOB_POOL_LINK=mingyue_link"
            ])
        }
    }
}
`
            // Register before Expo/RN can evaluate the app project eagerly.
            const rootPlugin = 'apply plugin: "expo-root-project"'
            if (!config.modResults.contents.includes(rootPlugin)) {
                throw new Error('Cannot locate the Expo root plugin in Android build.gradle')
            }
            config.modResults.contents = config.modResults.contents.replace(
                rootPlugin,
                boundedBuild + '\n' + rootPlugin
            )
        }
        return config
    })
}
