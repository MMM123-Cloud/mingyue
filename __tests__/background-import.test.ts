jest.mock('@lib/storage/MMKV', () => ({
    createMMKVStorage: () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} }),
}))
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }))
jest.mock('@lib/utils/File', () => ({
    AppDirectory: { Assets: 'file:///assets/' },
    copyFile: jest.fn(),
    deleteFile: jest.fn(),
}))
jest.mock('@lib/state/Logger', () => ({
    Logger: { infoToast: jest.fn(), error: jest.fn(), warnToast: jest.fn() },
}))

import { getDocumentAsync } from 'expo-document-picker'
import { useBackgroundStore } from '../lib/state/BackgroundImage'
import { Logger } from '../lib/state/Logger'
import { copyFile } from '../lib/utils/File'

beforeEach(() => {
    jest.clearAllMocks()
    useBackgroundStore.setState({ image: 'previous.png' })
    jest.mocked(getDocumentAsync).mockResolvedValue({
        canceled: false,
        assets: [
            { uri: 'file:///picked.png', name: 'new.png', mimeType: 'image/png', lastModified: 0 },
        ],
    })
})

test('keeps the visible background until the selected image has finished copying', async () => {
    let finish!: (value: boolean) => void
    jest.mocked(copyFile).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        })
    )
    const importing = useBackgroundStore.getState().importImage()
    await Promise.resolve()
    expect(useBackgroundStore.getState().image).toBe('previous.png')
    expect(Logger.infoToast).not.toHaveBeenCalled()
    finish(true)
    await importing
    expect(useBackgroundStore.getState().image).toBe('new.png')
    expect(Logger.infoToast).toHaveBeenCalledTimes(1)
})

test('a failed copy preserves the previous background without a success notification', async () => {
    jest.mocked(copyFile).mockResolvedValueOnce(false)
    await useBackgroundStore.getState().importImage()
    expect(useBackgroundStore.getState().image).toBe('previous.png')
    expect(Logger.infoToast).not.toHaveBeenCalled()
    expect(Logger.error).toHaveBeenCalled()
})
