/** Native file APIs expect decoded paths; keep plain paths and literal plus signs intact. */
export function nativeFilePath(uri: string) {
    return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri
}
