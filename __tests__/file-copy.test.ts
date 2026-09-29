const mockCopy = jest.fn()
jest.mock('expo-file-system', () => ({
    File: class {
        copy(...args: unknown[]) {
            return mockCopy(...args)
        }
    },
    Paths: { document: { uri: 'file:///documents/' }, cache: { uri: 'file:///cache/' } },
}))
jest.mock('expo-document-picker', () => ({}))
jest.mock('@vali98/react-native-fs', () => ({ localDownload: jest.fn() }))
jest.mock('../lib/state/Logger', () => ({ Logger: { error: jest.fn() } }))

import { copyFile } from '../lib/utils/File'

test('copy completion is awaited before reporting a successful import', async () => {
    let finish!: () => void
    mockCopy.mockReturnValueOnce(
        new Promise<void>((resolve) => {
            finish = resolve
        })
    )
    let complete = false
    const result = copyFile({ from: 'file:///source', to: 'file:///target' }).then((value) => {
        complete = true
        return value
    })
    await Promise.resolve()
    expect(complete).toBe(false)
    finish()
    await expect(result).resolves.toBe(true)
})

test('asynchronous copy failures are reported without a false success', async () => {
    mockCopy.mockRejectedValueOnce(new Error('storage denied'))
    await expect(copyFile({ from: 'file:///source', to: 'file:///target' })).resolves.toBe(false)
})
