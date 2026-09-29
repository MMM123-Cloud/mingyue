type ImportSteps = {
    validate: () => Promise<void>
    backup: () => Promise<void>
    apply: () => Promise<void>
    restore: () => Promise<void>
}

/** Never touch the live database before both validation and recovery backup succeed. */
export async function safelyImportDatabase(steps: ImportSteps) {
    await steps.validate()
    await steps.backup()
    try {
        await steps.apply()
    } catch (error) {
        try {
            await steps.restore()
        } catch (restoreError) {
            throw new AggregateError(
                [error, restoreError],
                '导入和自动恢复失败，原始备份仍保留在设备中。'
            )
        }
        throw error
    }
}
export function assertBackupColumns(table: string, actual: string[], expected: string[]) {
    if (!expected.every((name) => actual.includes(name))) {
        throw new Error(`备份中的 ${table} 表结构不兼容，当前数据未更改。`)
    }
}
