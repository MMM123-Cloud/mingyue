import { assertBackupColumns, safelyImportDatabase } from '../lib/utils/SafeDatabaseImport'

test('backups with matching table names but missing columns are rejected', () => {
    expect(() => assertBackupColumns('characters', ['id'], ['id', 'name', 'type'])).toThrow(
        '表结构不兼容'
    )
    expect(() =>
        assertBackupColumns('characters', ['id', 'name', 'type', 'extra'], ['id', 'name', 'type'])
    ).not.toThrow()
})

test('invalid imports and failed recovery backups never modify live data', async () => {
    for (const failingStep of ['validate', 'backup'] as const) {
        const steps = {
            validate: jest.fn(async () => {}),
            backup: jest.fn(async () => {}),
            apply: jest.fn(async () => {}),
            restore: jest.fn(async () => {}),
        }
        steps[failingStep].mockRejectedValueOnce(new Error('file unavailable'))
        await expect(safelyImportDatabase(steps)).rejects.toThrow('file unavailable')
        expect(steps.apply).not.toHaveBeenCalled()
        expect(steps.restore).not.toHaveBeenCalled()
    }
})

test('a failed replacement restores the previous database', async () => {
    let live = 'original chat history'
    let backup = ''
    await expect(
        safelyImportDatabase({
            validate: async () => {},
            backup: async () => {
                backup = live
            },
            apply: async () => {
                live = 'partial replacement'
                throw new Error('storage full')
            },
            restore: async () => {
                live = backup
            },
        })
    ).rejects.toThrow('storage full')
    expect(live).toBe('original chat history')
})

test('successful imports use the snapshot and do not restore old data', async () => {
    const order: string[] = []
    await safelyImportDatabase({
        validate: async () => {
            order.push('validate')
        },
        backup: async () => {
            order.push('backup')
        },
        apply: async () => {
            order.push('apply')
        },
        restore: async () => {
            order.push('restore')
        },
    })
    expect(order).toEqual(['validate', 'backup', 'apply'])
})
