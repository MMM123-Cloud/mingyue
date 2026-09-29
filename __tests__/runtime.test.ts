import { matchedTokenPrefix, runtimeConfig } from '../lib/engine/Local/RuntimeConfig'

const config = {
    context_length: 1024,
    threads: 4,
    gpu_layers: 0,
    batch: 64,
    ctx_shift: true,
    devices: [],
}
test('keeps compact settings and respects model context without mutating preferences', () => {
    expect(
        runtimeConfig({ file_size: 400_000_000, context_length: 512 }, config).context_length
    ).toBe(512)
    expect(
        runtimeConfig({ file_size: 400_000_000, context_length: 32768 }, config).context_length
    ).toBe(1024)
    expect(config.context_length).toBe(1024)
})
test('rejects invalid allocations and caps memory for large models', () => {
    const result = runtimeConfig(
        { file_size: 8 * 1024 ** 3, context_length: 32768 },
        {
            ...config,
            context_length: 8192,
            threads: NaN,
            batch: -1,
        }
    )
    expect(result.context_length).toBe(1536)
    expect(result.threads).toBe(4)
    expect(result.batch).toBe(16)
})
test('KV cache match stops at the first different token', () => {
    expect(matchedTokenPrefix([1, 9, 3, 4], [1, 2, 3, 4])).toBe(1)
    expect(matchedTokenPrefix([1, 2], [1, 2, 3])).toBe(2)
    expect(matchedTokenPrefix([], [1])).toBe(0)
})
