// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

const escapedNestedWorkDir = path
    .resolve(__dirname, 'work')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

config.resolver.sourceExts.push('sql')
config.resolver.assetExts.push('gguf', 'raw')
config.resolver.blockList = [new RegExp(`^${escapedNestedWorkDir}[\\\\/]`)]

module.exports = config
