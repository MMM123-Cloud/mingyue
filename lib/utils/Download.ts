import { localDownload } from '@vali98/react-native-fs'
import { Directory, File } from 'expo-file-system'
import { Platform } from 'react-native'

import { nativeFilePath } from './NativeFilePath'

export async function downloadLocalFile(uri: string): Promise<boolean> {
    if (Platform.OS !== 'android' || Number(Platform.Version) >= 29) {
        await localDownload(nativeFilePath(uri))
        return true
    }
    // MediaStore.Downloads requires Android 10; older phones use the system folder picker.
    try {
        const directory = await Directory.pickDirectoryAsync()
        const name = nativeFilePath(uri).split('/').pop()!
        const mime = name.endsWith('.txt') ? 'text/plain' : 'application/octet-stream'
        const destination = directory.createFile(name, mime)
        await new File(uri).copy(destination, { overwrite: true })
        return true
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ERR_PICKER_CANCELLED'
        )
            return false
        throw error
    }
}
