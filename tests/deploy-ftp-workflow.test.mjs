import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowPath = new URL(
    '../.github/workflows/deploy-ftp.yml',
    import.meta.url
)

/**
 * Verifies the FTP workflow deploys the PHP metadata directory used by LIVE.
 */
test('ftp workflow deploys the api directory', async () => {
    const workflow = await readFile(workflowPath, 'utf8')

    assert.match(workflow, /api:\s*\n\s*- 'api\/\*\*'/)
    assert.match(workflow, /name: Deploy api to \.\/api\//)
    assert.match(workflow, /local-dir: \.\/api\//)
    assert.match(workflow, /server-dir: \.\/api\//)
})
