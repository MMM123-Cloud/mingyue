import { AppState } from 'react-native'

import { Logger } from '@lib/state/Logger'
import { mmkv } from '@lib/storage/MMKV'

const OFFSET_KEY = 'mingyue-network-time-offset-ms'
const LAST_SYNC_KEY = 'mingyue-network-time-last-sync-ms'
const SYNCED_KEY = 'mingyue-network-time-synced'
const SYNC_INTERVAL = 3 * 60 * 60 * 1000
const MAX_REASONABLE_OFFSET = 14 * 24 * 60 * 60 * 1000
const TIME_ENDPOINTS = ['https://www.baidu.com/', 'https://www.qq.com/']

let syncPromise: Promise<boolean> | null = null
let syncStarted = false

const readStoredNumber = (key: string) => {
    const value = mmkv.getNumber(key)
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const getOffset = () => {
    if (!mmkv.getBoolean(SYNCED_KEY)) return 0
    const offset = readStoredNumber(OFFSET_KEY)
    if (!Number.isFinite(offset) || Math.abs(offset) > MAX_REASONABLE_OFFSET) return 0
    return offset
}

export const getNetworkNow = () => Date.now() + getOffset()

export const getNetworkDate = () => new Date(getNetworkNow())

export const getNetworkTimeOffset = () => getOffset()

export const isNetworkTimeSynced = () => mmkv.getBoolean(SYNCED_KEY) === true

const requestServerTime = async (endpoint: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const startedAt = Date.now()

    try {
        const response = await fetch(endpoint, {
            method: 'HEAD',
            headers: {
                'Cache-Control': 'no-cache, no-store',
                Pragma: 'no-cache',
            },
            signal: controller.signal,
        })
        const dateHeader = response.headers.get('date')
        const receivedAt = Date.now()
        if (!response.ok || !dateHeader) return null

        const serverAt = Date.parse(dateHeader)
        if (!Number.isFinite(serverAt)) return null

        const latency = Math.max(0, receivedAt - startedAt)
        const offset = Math.round(serverAt + latency / 2 - receivedAt)
        if (!Number.isFinite(offset) || Math.abs(offset) > MAX_REASONABLE_OFFSET) return null
        return offset
    } finally {
        clearTimeout(timeout)
    }
}

export const syncNetworkTime = async (force = false) => {
    const lastSync = readStoredNumber(LAST_SYNC_KEY)
    if (!force && isNetworkTimeSynced() && Date.now() - lastSync < SYNC_INTERVAL) return true
    if (syncPromise) return syncPromise

    syncPromise = (async () => {
        for (const endpoint of TIME_ENDPOINTS) {
            try {
                const offset = await requestServerTime(endpoint)
                if (offset === null) continue

                mmkv.set(OFFSET_KEY, offset)
                mmkv.set(LAST_SYNC_KEY, Date.now())
                mmkv.set(SYNCED_KEY, true)
                Logger.info(`Network time synced with offset ${offset}ms`)
                return true
            } catch (error) {
                Logger.warn(`Network time request failed for ${endpoint}: ${error}`)
            }
        }

        mmkv.set(LAST_SYNC_KEY, Date.now())
        return false
    })()

    try {
        return await syncPromise
    } finally {
        syncPromise = null
    }
}

export const startNetworkTimeSync = () => {
    if (syncStarted) return
    syncStarted = true

    void syncNetworkTime(true)
    setInterval(() => {
        void syncNetworkTime(true)
    }, SYNC_INTERVAL)

    AppState.addEventListener('change', (state) => {
        if (state === 'active') void syncNetworkTime()
    })
}
