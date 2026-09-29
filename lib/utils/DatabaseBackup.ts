import { File, Paths } from 'expo-file-system'
import { backupDatabaseAsync, openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite'
import { is } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { migrate } from 'drizzle-orm/expo-sqlite/migrator'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'

import { sqliteDB } from '@db/db'
import migrations from '@db/migrations/migrations'
import * as schema from '@db/schema'

import { assertBackupColumns, safelyImportDatabase } from './SafeDatabaseImport'
import { loadVectorExtension } from './VectorExtension'

export async function exportDatabaseSnapshot(version: string) {
    const name = `${version}-明月备份-${Date.now()}.db`
    const destination = await openDatabaseAsync(name, { useNewConnection: true }, Paths.cache.uri)
    try {
        // SQLite's backup API includes committed WAL pages while the source stays open.
        await backupDatabaseAsync({ sourceDatabase: sqliteDB, destDatabase: destination })
    } finally {
        await destination.closeAsync()
    }
    return new File(Paths.cache, name).uri
}

export async function importDatabaseSnapshot(uri: string) {
    const suffix = Date.now()
    const stagedName = `mingyue-import-${suffix}.db`
    const staged = new File(Paths.cache, stagedName)
    await new File(uri).copy(staged)
    let candidate: SQLiteDatabase | undefined
    let recovery: SQLiteDatabase | undefined
    try {
        candidate = await openDatabaseAsync(stagedName, { useNewConnection: true }, Paths.cache.uri)
        const source = candidate
        await safelyImportDatabase({
            validate: async () => {
                await loadVectorExtension(source)
                const check = await source.getFirstAsync<{ quick_check: string }>(
                    'PRAGMA quick_check'
                )
                if (check?.quick_check !== 'ok') throw new Error('备份文件损坏，当前数据未更改。')
                const tables = await source.getAllAsync<{ name: string }>(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                )
                if (
                    !['characters', 'chats', 'chat_entries', 'chat_swipes'].every((name) =>
                        tables.some((table) => table.name === name)
                    )
                ) {
                    throw new Error('这不是兼容的明月数据库备份，当前数据未更改。')
                }
                // Upgrade only the staged copy. A corrupt schema must never replace the live DB.
                await migrate(drizzle(source), migrations)
                for (const table of Object.values(schema)) {
                    if (!is(table, SQLiteTable)) continue
                    const config = getTableConfig(table)
                    const columns = await source.getAllAsync<{ name: string }>(
                        `PRAGMA table_info("${config.name.replaceAll('"', '""')}")`
                    )
                    assertBackupColumns(
                        config.name,
                        columns.map((column) => column.name),
                        config.columns.map((column) => column.name)
                    )
                }
            },
            backup: async () => {
                recovery = await openDatabaseAsync(
                    `mingyue-before-import-${suffix}.db`,
                    { useNewConnection: true },
                    Paths.cache.uri
                )
                await backupDatabaseAsync({ sourceDatabase: sqliteDB, destDatabase: recovery })
            },
            apply: async () => {
                await backupDatabaseAsync({ sourceDatabase: source, destDatabase: sqliteDB })
            },
            restore: async () => {
                if (recovery)
                    await backupDatabaseAsync({ sourceDatabase: recovery, destDatabase: sqliteDB })
            },
        })
    } finally {
        // The live handle and its WAL are never deleted or replaced as raw files.
        await Promise.allSettled([candidate?.closeAsync(), recovery?.closeAsync()])
        try {
            if (staged.exists) staged.delete()
        } catch {
            // Cache cleanup must not hide the result of import or recovery.
        }
    }
}
