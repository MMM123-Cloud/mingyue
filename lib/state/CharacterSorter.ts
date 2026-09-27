import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { Storage } from '@lib/enums/Storage'
import { createMMKVStorage } from '@lib/storage/MMKV'

export type SearchOrder = 'asc' | 'desc'
export type SearchType = 'name' | 'modified'

type CharacterListSorterProps = {
    showSearch: boolean
    searchOrder: SearchOrder
    searchType: SearchType
    setShowSearch: (b: boolean) => void
    tagFilter: string[]
    textFilter: string
    setOrder: (order: SearchOrder) => void
    setType: (type: SearchType) => void
    setTextFilter: (value: string) => void
    setTagFilter: (filter: string[]) => void
}

export namespace CharacterSorter {
    export const useSorterStore = create<CharacterListSorterProps>()(
        persist(
            (set, get) => ({
                showSearch: false,
                searchType: 'modified',
                searchOrder: 'desc',
                textFilter: '',
                tagFilter: [],
                setShowSearch: (b) => {
                    if (b) set({ showSearch: b })
                    else set({ showSearch: b })
                    if (get().tagFilter.length > 0) set({ tagFilter: [] })
                    if (get().textFilter) set({ textFilter: '' })
                },

                setTextFilter: (textFilter: string) => {
                    set({
                        textFilter: textFilter,
                    })
                },
                setTagFilter: (tagFilter: string[]) => {
                    set({
                        tagFilter: tagFilter,
                    })
                },
                setOrder: (order) => set({ searchOrder: order }),
                setType: (type) => set({ searchType: type }),
            }),
            {
                name: Storage.CharacterSearch,
                storage: createMMKVStorage(),
                version: 1,
                partialize: (item) => ({
                    searchType: item.searchType,
                    searchOrder: item.searchOrder,
                }),
            }
        )
    )
}
