'use client'

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback
} from 'react'

import { StoreState } from './GlobalContextStates'


export interface GlobalContextType {
    setValue: <K extends keyof StoreState>(key: K, value: StoreState[K]) => void
    getValue: <K extends keyof StoreState>(key: K) => StoreState[K]
    clearValue: <K extends keyof StoreState>(key: K) => void
    clearStore: () => void
}


const GlobalContext = createContext<GlobalContextType | undefined>(undefined)


export const GlobalProvider = ({ children }: { children: ReactNode }) => {

    /**
     * Initialize state safely from localStorage
     */
    const [store, setStore] = useState<StoreState>(() => {
        if (typeof window === 'undefined') return {} as StoreState

        try {
            const stored = localStorage.getItem('app_store')
            return stored ? JSON.parse(stored) : {}
        } catch (error) {
            console.error('Failed to parse store from localStorage', error)
            return {} as StoreState
        }
    })


    /**
     * Sync store to localStorage
     */
    useEffect(() => {
        try {
            localStorage.setItem('app_store', JSON.stringify(store))
        } catch (error) {
            console.error('Failed to save to localStorage', error)
        }
    }, [store])


    /**
     * Set value
     */
    const setValue = useCallback(
        <K extends keyof StoreState>(key: K, value: StoreState[K]) => {
            setStore((prev) => ({
                ...prev,
                [key]: value
            }))
        },
        []
    )


    /**
     * Get value
     */
    const getValue = useCallback(
        <K extends keyof StoreState>(key: K): StoreState[K] => {
            return store[key]
        },
        [store]
    )


    /**
     * Clear single key
     */
    const clearValue = useCallback(
        <K extends keyof StoreState>(key: K) => {
            setStore((prev) => {
                const updated = { ...prev }
                delete updated[key]
                return updated
            })
        },
        []
    )


    /**
     * Clear entire store
     */
    const clearStore = useCallback(() => {
        setStore({} as StoreState)
    }, [])


    return (
        <GlobalContext.Provider
            value={{
                setValue,
                getValue,
                clearValue,
                clearStore
            }}
        >
            {children}
        </GlobalContext.Provider>
    )
}


/**
 * Hook access helper
 */
export const useGlobalContext = () => {
    const context = useContext(GlobalContext)

    if (!context) {
        throw new Error(
            'useGlobalContext must be used within a GlobalProvider'
        )
    }

    return context
}