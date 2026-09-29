import { nativeFilePath } from '../lib/utils/NativeFilePath'

test('native downloads decode Unicode file URIs once without altering plain paths', () => {
    expect(nativeFilePath('file:///cache/%E6%98%8E%E6%9C%88%20backup%25+1.db')).toBe(
        '/cache/明月 backup%+1.db'
    )
    expect(nativeFilePath('file:///cache/literal%2520.txt')).toBe('/cache/literal%20.txt')
    expect(nativeFilePath('/cache/100% real+name.txt')).toBe('/cache/100% real+name.txt')
})
