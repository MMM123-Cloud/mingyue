import { getContentModeForModel } from '@lib/state/ContentMode'

type ModelIdentityInput = {
    name?: string
    file?: string
    params?: string
    architecture?: string
    mmprojName?: string
}

export type ModelIdentity = {
    family: string
    parameters?: string
    contentMode: 'safe' | 'adult'
    contentLabel: string
    supportsVision: boolean
    detected: boolean
    tags: string[]
}

const familyPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /qwen\s*3/i, label: 'Qwen3' },
    { pattern: /qwen\s*2\.5/i, label: 'Qwen2.5' },
    { pattern: /qwen\s*2/i, label: 'Qwen2' },
    { pattern: /deepseek/i, label: 'DeepSeek' },
    { pattern: /llama\s*3/i, label: 'Llama 3' },
    { pattern: /llama/i, label: 'Llama' },
    { pattern: /gemma\s*3/i, label: 'Gemma 3' },
    { pattern: /gemma/i, label: 'Gemma' },
    { pattern: /mistral/i, label: 'Mistral' },
    { pattern: /phi-?3/i, label: 'Phi-3' },
    { pattern: /phi-?4/i, label: 'Phi-4' },
    { pattern: /glm/i, label: 'GLM' },
    { pattern: /smollm/i, label: 'SmolLM' },
    { pattern: /granite/i, label: 'Granite' },
]

const isKnownValue = (value?: string) =>
    !!value && !['n/a', 'unknown', 'undefined', 'null', '-1'].includes(value.trim().toLowerCase())

const normalizeParameters = (value?: string) => {
    if (!isKnownValue(value)) return undefined
    const match = value?.match(/([0-9]+(?:\.[0-9]+)?)\s*[bB]\b/)
    return match ? `${match[1]}B` : value?.trim()
}

export const identifyModel = (input: ModelIdentityInput): ModelIdentity => {
    const source = [input.name, input.file, input.params, input.architecture]
        .filter(isKnownValue)
        .join(' ')

    const family =
        familyPatterns.find(({ pattern }) => pattern.test(source))?.label ??
        (!isKnownValue(input.architecture) ? '待识别' : input.architecture!.toUpperCase())
    const parameters =
        normalizeParameters(input.params) ??
        source.match(/([0-9]+(?:\.[0-9]+)?)\s*[bB]\b/)?.[0]?.toUpperCase()
    const contentMode = getContentModeForModel(`${input.file ?? ''} ${input.name ?? ''}`)
    const supportsVision = !!input.mmprojName
    const detected = family !== '待识别'
    const contentLabel =
        contentMode === 'adult'
            ? '本地模式'
            : detected
              ? '通用模型 · 安全模式'
              : '未知模型 · 安全模式'

    return {
        family,
        parameters,
        contentMode,
        contentLabel,
        supportsVision,
        detected,
        tags: [family, parameters, contentLabel, supportsVision ? '支持图片' : undefined].filter(
            Boolean
        ) as string[],
    }
}
