import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootUrl = new URL('../', import.meta.url)
const rootPath = fileURLToPath(rootUrl)
const builderUrl = new URL('../src/StaticDeployBuilder.mjs', import.meta.url)

/**
 * Checks whether a repository file exists.
 * @param {URL} fileUrl
 * @returns {Promise<boolean>}
 */
async function exists(fileUrl) {
    try {
        await access(fileUrl, constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Imports a fresh copy of the static deploy builder.
 * @returns {Promise<typeof import('../src/StaticDeployBuilder.mjs')>}
 */
async function importStaticDeployBuilder() {
    return import(builderUrl.href + '?test=' + Date.now())
}

/**
 * Verifies the static deploy builder emits the same cache-busted shell and
 * browser-safe module graph that the local Node server serves dynamically.
 */
test('static deploy builder writes versioned Apache assets', async (t) => {
    assert.equal(
        await exists(builderUrl),
        true,
        'Missing src/StaticDeployBuilder.mjs'
    )

    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url)
    )
    const pkg = JSON.parse(packageRaw)
    const outputRoot = await mkdtemp(
        path.join(tmpdir(), 'ecadforge-static-deploy-')
    )
    const { StaticDeployBuilder } = await importStaticDeployBuilder()

    t.after(async () => {
        await rm(outputRoot, { force: true, recursive: true })
    })

    await StaticDeployBuilder.build({
        projectRoot: rootPath,
        sourceRoot: path.join(rootPath, 'src'),
        outputRoot
    })

    const indexHtml = await readFile(
        path.join(outputRoot, 'index.html'),
        'utf8'
    )
    const mainSource = await readFile(path.join(outputRoot, 'main.mjs'), 'utf8')
    const parserWorkerSource = await readFile(
        path.join(outputRoot, 'workers', 'ecad-parser.worker.mjs'),
        'utf8'
    )
    const htaccessSource = await readFile(
        path.join(outputRoot, '.htaccess'),
        'utf8'
    )

    assert.match(indexHtml, new RegExp('/style\\.css\\?v=' + pkg.version))
    assert.match(indexHtml, new RegExp('/main\\.mjs\\?v=' + pkg.version))
    assert.match(
        mainSource,
        new RegExp('\\./AppController\\.mjs\\?v=' + pkg.version)
    )
    assert.doesNotMatch(
        parserWorkerSource,
        /from ['"]\.\.\/core\/ecad\/EcadParserService\.mjs['"]/
    )
    assert.match(
        parserWorkerSource,
        new RegExp(
            '\\.\\./core/ecad/EcadParserService\\.mjs\\?v=' + pkg.version
        )
    )
    assert.match(htaccessSource, /Cache-Control/)
    assert.match(htaccessSource, /no-store/)
})
