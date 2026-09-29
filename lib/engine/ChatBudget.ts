type ChatMessage = { role: string; content: string }

/** Fit whole turns to the native context; stored history stays intact. */
export const fitChatPrompt = async (
    system: string,
    history: ChatMessage[],
    budget: number,
    format: (messages: ChatMessage[]) => Promise<string>,
    count: (prompt: string) => Promise<number>
) => {
    const starts = history.flatMap((message, index) => (message.role === 'user' ? [index] : []))
    if (starts.length === 0) throw new Error('没有可发送的消息。')
    let low = 0
    let high = starts.length - 1
    let best: string | undefined
    while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const prompt = await format([
            { role: 'system', content: system },
            ...history.slice(starts[mid]),
        ])
        if ((await count(prompt)) <= budget) {
            best = prompt
            high = mid - 1
        } else {
            low = mid + 1
        }
    }
    if (!best) throw new Error('这条消息超过模型上下文，请缩短消息后重试。')
    return best
}
