import { create } from 'zustand'

export type ContextMenuStoreProps = {
    openMenuId: string | null
    openMenu: (id: string) => void
    closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuStoreProps>((set) => ({
    openMenuId: null,
    openMenu: (id) => set({ openMenuId: id }),
    closeMenu: () => set({ openMenuId: null }),
}))
