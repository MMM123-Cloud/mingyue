import { bundledExtensions, SQLiteDatabase } from 'expo-sqlite'
import { Platform } from 'react-native'

export async function loadVectorExtension(database: SQLiteDatabase) {
    const extension = bundledExtensions['sqlite-vec']
    if (!extension) return
    // Android packages/loaders recognize native libraries with the lib*.so name.
    const path = Platform.OS === 'android' ? 'libvec.so' : extension.libPath
    await database.loadExtensionAsync(path, extension.entryPoint)
    const result = await database.getFirstAsync<{ version: string }>(
        'SELECT vec_version() AS version'
    )
    return result?.version
}
