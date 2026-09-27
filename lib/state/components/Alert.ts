import { create } from 'zustand'

type AlertStoreProps = {
    visible: boolean
    props: AlertProps
    hide: () => void
    show: (props: AlertProps) => void
}

export type AlertProps = {
    title: string
    description: string
    buttons: AlertButtonProps[]
    alignButtons?: 'left' | 'right'
    onDismiss?: () => void
}

export type AlertButtonProps = {
    label: string
    onPress?: () => void | Promise<void>
    type?: 'warning' | 'default'
}

export const useAlertStore = create<AlertStoreProps>()((set, get) => ({
    visible: false,
    props: {
        title: 'Are You Sure?',
        description: 'LIke `sure` sure?',
        buttons: [
            { label: 'Cancel', onPress: () => {}, type: 'default' },
            { label: 'Confirm', onPress: () => {}, type: 'warning' },
        ],
        alignButtons: 'right',
    },
    hide: () => {
        set({ visible: false })
    },
    show: (props: AlertProps) => {
        set({ visible: true, props: props })
    },
}))
