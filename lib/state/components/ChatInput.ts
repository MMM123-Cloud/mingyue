import { create } from 'zustand'

type ChatInputTextStoreProps = {
    text: string
    setText: (text: string) => void
}

export const useChatInputTextStore = create<ChatInputTextStoreProps>()((set) => ({
    text: '',
    setText: (text) => set({ text }),
}))
