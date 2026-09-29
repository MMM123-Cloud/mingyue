import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite'

import { loadVectorExtension } from '@lib/utils/VectorExtension'

import * as schema from './schema'

//deleteDatabaseAsync('db.db')
export const sqliteDB = openDatabaseSync('db.db', { enableChangeListener: true })
export const loadDatabaseExtensions = () => loadVectorExtension(sqliteDB)
export const db = drizzle(sqliteDB, { schema })

export type TableNames = {
    [K in keyof typeof schema]: (typeof schema)[K] extends { _: { name: infer TName } }
        ? TName & string
        : never
}[keyof typeof schema]

sqliteDB.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
