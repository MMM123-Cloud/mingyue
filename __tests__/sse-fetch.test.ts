jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('@lib/state/Logger', () => ({ Logger: { error: jest.fn(), debug: jest.fn() } }))

import { fetch } from 'expo/fetch'
import { TextDecoder as NodeTextDecoder } from 'util'

import { SSEFetch } from '../lib/engine/SSEFetch'

const request = {
    endpoint: 'https://example.invalid/stream',
    method: 'POST' as const,
    body: '{}',
    headers: {},
}
beforeAll(() => {
    global.TextDecoder = NodeTextDecoder as typeof TextDecoder
})
test('decodes Chinese and emoji even when every UTF-8 byte arrives separately', async () => {
    const bytes = Buffer.from('data: {"text":"你好 🌙"}\n\ndata: [DONE]\n\n', 'utf-8')
    let index = 0
    const reader = {
        read: async () =>
            index < bytes.length
                ? { done: false, value: bytes.subarray(index, ++index) }
                : { done: true },
        cancel: jest.fn(async () => {}),
    }
    ;(fetch as jest.Mock).mockResolvedValue({ ok: true, body: { getReader: () => reader } })
    const events: string[] = []
    const close = jest.fn()
    const stream = new SSEFetch()
    stream.setOnEvent((event) => events.push(event))
    stream.setOnClose(close)
    await stream.start(request)
    expect(events).toEqual(['{"text":"你好 🌙"}'])
    expect(close).toHaveBeenCalledTimes(1)
    expect(reader.cancel).toHaveBeenCalled()
})
test('reports a failed transport and closes once', async () => {
    ;(fetch as jest.Mock).mockRejectedValue(new Error('network disconnected'))
    const stream = new SSEFetch()
    const error = jest.fn()
    const close = jest.fn()
    stream.setOnError(error)
    stream.setOnClose(close)
    await stream.start(request)
    expect(error).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
})
