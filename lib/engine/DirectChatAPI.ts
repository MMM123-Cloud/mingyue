import { CLAUDE_VERSION } from '@lib/constants/GlobalValues'
import { Instructs, InstructType } from '@lib/state/Instructs'
import { SamplersManager } from '@lib/state/SamplerState'
import { getNestedValue } from '@lib/utils/Parsing'

import { APIManager } from './API/APIManagerState'
import type { Message } from './API/ContextBuilder'
import { buildRequest } from './API/RequestBuilder'
import { SSEFetch } from './SSEFetch'

export type DirectChatMessage = {
    role: 'user' | 'assistant'
    content: string
}

type DirectChatAPIParams = {
    systemPrompt: string
    history: DirectChatMessage[]
    onToken: (token: string) => void
    signal?: AbortSignal
}

const buildTextPrompt = (
    history: DirectChatMessage[],
    systemPrompt: string,
    instruct: InstructType
) => {
    let output = systemPrompt + instruct.system_suffix

    history.forEach((item, index) => {
        const isLast = index === history.length - 1
        let prefix = item.role === 'user' ? instruct.input_prefix : instruct.output_prefix
        let suffix = item.role === 'user' ? instruct.input_suffix : instruct.output_suffix

        if (isLast && item.role === 'assistant') {
            prefix = instruct.last_output_prefix
            suffix = ''
        }

        output += prefix + item.content + suffix
        if (instruct.wrap && !(isLast && item.role === 'assistant')) output += '\n'
    })

    const last = history[history.length - 1]
    if (!last || last.role !== 'assistant') output += instruct.last_output_prefix
    return output
}

export const generateDirectChatAPI = async ({
    systemPrompt,
    history,
    onToken,
    signal,
}: DirectChatAPIParams) => {
    const { activeIndex, values, getTemplates } = APIManager.useConnectionsStore.getState()
    const apiValues = values[activeIndex]
    if (!apiValues) {
        throw new Error('API 模式还没有启用连接')
    }

    const apiConfig = getTemplates().find((item) => item.name === apiValues.configName)
    if (!apiConfig) {
        throw new Error('找不到当前 API 连接配置')
    }
    if (apiConfig.request.requestType !== 'stream') {
        throw new Error('直接对话暂不支持 Horde')
    }

    const instructState = Instructs.useInstruct.getState()
    const instruct = {
        ...instructState.replacedMacros(),
        system_prompt: systemPrompt,
    }
    const samplers = SamplersManager.getCurrentSampler()
    const stopSequence = instructState.getStopSequence()
    const completionType = apiConfig.request.completionType

    let prompt: string | Message[]
    if (completionType.type === 'chatCompletions') {
        prompt = [
            {
                role: completionType.systemRole,
                [completionType.contentName]: systemPrompt,
            },
            ...history.map((item) => ({
                role: item.role === 'user' ? completionType.userRole : completionType.assistantRole,
                [completionType.contentName]: item.content,
            })),
        ] as Message[]
    } else {
        prompt = buildTextPrompt(history, systemPrompt, instruct)
    }

    let payload = await buildRequest({
        apiConfig,
        apiValues,
        samplers,
        instruct,
        stopSequence,
        prompt,
    })
    if (!payload) {
        throw new Error('API 请求内容生成失败')
    }
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)

    const header: Record<string, string> = {}
    if (apiConfig.name === 'Claude') {
        header['anthropic-version'] = CLAUDE_VERSION
    }
    if (apiConfig.features.useKey) {
        header[apiConfig.request.authHeader] = apiConfig.request.authPrefix + apiValues.key
    }

    const patterns = [apiConfig.request.responseParsePattern]
    if (apiConfig.request.reasoningParsePattern) {
        patterns.push(...apiConfig.request.reasoningParsePattern)
    }

    await new Promise<void>((resolve, reject) => {
        const sse = new SSEFetch()
        let settled = false
        const abort = () => {
            sse.abort()
            finish()
        }

        const finish = (error?: Error) => {
            if (settled) return
            settled = true
            signal?.removeEventListener('abort', abort)
            if (error) reject(error)
            else resolve()
        }

        sse.setOnEvent((data) => {
            try {
                const parsed = JSON.parse(data)
                const output = getNestedValue(parsed, patterns)
                if (typeof output !== 'string' || !output) return

                const token = stopSequence.reduce(
                    (value, stop) => value.split(stop).join(''),
                    output
                )
                if (token) onToken(token)
            } catch {
                // Some compatible APIs send non-JSON keepalive events.
            }
        })
        sse.setOnError(() => finish(new Error('API 流式连接失败')))
        sse.setOnClose(() => finish())
        if (signal?.aborted) {
            finish()
            return
        }
        signal?.addEventListener('abort', abort, { once: true })
        void sse.start({
            endpoint: apiValues.endpoint,
            body,
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                ...header,
            },
        })
    })
}
