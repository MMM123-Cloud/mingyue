import { fitChatPrompt } from '../lib/engine/ChatBudget'

const format = async (messages: { content: string }[]) => messages.map((m) => m.content).join('|')
const count = async (prompt: string) => prompt.length
test('trims oldest full turns while keeping the system and latest user input', async () => {
    const history = [
        { role: 'user', content: 'old' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'new' },
    ]
    expect(await fitChatPrompt('sys', history, 8, format, count)).toBe('sys|new')
    expect(history).toHaveLength(3)
})
test('retains all history when it fits and rejects oversized latest input', async () => {
    const history = [{ role: 'user', content: 'hello' }]
    expect(await fitChatPrompt('sys', history, 20, format, count)).toBe('sys|hello')
    await expect(fitChatPrompt('sys', history, 3, format, count)).rejects.toThrow('上下文')
})
