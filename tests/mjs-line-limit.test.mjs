import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const LINE_LIMIT = 1000

/**
 * Recursively collects .mjs files.
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function collectMjsFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(directory, entry.name)
            if (entry.isDirectory()) {
                return collectMjsFiles(fullPath)
            }
            return entry.isFile() && entry.name.endsWith('.mjs')
                ? [fullPath]
                : []
        })
    )
    return files.flat()
}

/**
 * Verifies all .mjs files in the given directory stay below the max line limit.
 * @param {string} directory
 * @param {string} label
 * @returns {Promise<void>}
 */
async function assertDirectoryLineLimit(directory, label) {
    const files = await collectMjsFiles(directory)
    const oversized = []

    for (const filePath of files) {
        const source = await readFile(filePath, 'utf8')
        const lineCount = source.split('\n').length
        if (lineCount >= LINE_LIMIT) {
            oversized.push(filePath + ' (' + lineCount + ' lines)')
        }
    }

    assert.deepEqual(
        oversized,
        [],
        'Found ' +
            label +
            ' .mjs files at or above ' +
            LINE_LIMIT +
            ' lines:\n' +
            oversized.join('\n')
    )
}

/**
 * Verifies all source modules stay below the max line limit.
 */
test('all source .mjs files stay below line limit', async () => {
    await assertDirectoryLineLimit('src', 'source')
})

/**
 * Verifies all test modules stay below the max line limit.
 */
test('all test .mjs files stay below line limit', async () => {
    await assertDirectoryLineLimit('tests', 'test')
})
