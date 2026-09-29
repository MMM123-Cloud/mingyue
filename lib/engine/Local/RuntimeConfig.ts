type RuntimeConfig = {
    context_length: number
    threads: number
    gpu_layers: number
    batch: number
    ctx_shift: boolean
    devices: string[]
}

const integer = (value: number, fallback: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback

/** Bound allocations without overwriting the user's saved preferences. */
export const runtimeConfig = (
    model: { file_size: number; context_length: number },
    config: RuntimeConfig
): RuntimeConfig => {
    const modelLimit = model.context_length > 0 ? Math.max(256, model.context_length) : 4096
    const memoryLimit = model.file_size >= 7 * 1024 ** 3 ? 1536 : 4096
    const maximumContext = Math.min(modelLimit, memoryLimit)
    const context = integer(
        config.context_length,
        Math.min(2048, maximumContext),
        256,
        maximumContext
    )
    return {
        context_length: context,
        threads: integer(config.threads, 4, 1, 8),
        gpu_layers: integer(config.gpu_layers, 0, 0, 999),
        batch: integer(config.batch, 128, 16, Math.min(256, context)),
        ctx_shift: config.ctx_shift !== false,
        devices: Array.isArray(config.devices) ? config.devices : [],
    }
}

export const estimatedModelMemory = (fileSize: number, contextLength: number) =>
    Math.ceil(Math.max(0, fileSize) * 1.15 + 384 * 1024 ** 2 + contextLength * 128 * 1024)

export const matchedTokenPrefix = (cached: number[], input: number[]) => {
    let length = 0
    while (length < Math.min(cached.length, input.length) && cached[length] === input[length])
        length++
    return length
}
