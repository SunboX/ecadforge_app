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

/**
 * Verifies the API deploy skips `.htaccess` so FTP hosts that reset dotfile
 * uploads can still publish the PHP metadata fallback.
 */
test('ftp workflow excludes api htaccess from FTP sync', async () => {
    const workflow = await readFile(workflowPath, 'utf8')

    assert.match(
        workflow,
        /name: Deploy api to \.\/api\/[\s\S]*?exclude: \|[\s\S]*?\*\*\/\.htaccess/
    )
})

/**
 * Verifies the FTP workflow deploys the package manifest to the LIVE document
 * root so the PHP metadata endpoint can read the current app version.
 */
test('ftp workflow deploys package.json to the live root on dependency changes', async () => {
    const workflow = await readFile(workflowPath, 'utf8')

    assert.match(workflow, /name: Stage package manifest for LIVE/)
    assert.match(workflow, /if: steps\.changes\.outputs\.deps == 'true'/)
    assert.match(workflow, /mkdir -p \.deploy-root/)
    assert.match(workflow, /cp package\.json \.deploy-root\/package\.json/)
    assert.match(
        workflow,
        /name: Deploy package manifest to \.\/[\s\S]*?local-dir: \.\/\.deploy-root\/[\s\S]*?server-dir: \.\//
    )
})

/**
 * Verifies the FTP workflow deploys the static frontend artifact produced for
 * Apache/shared-hosting instead of raw source files that rely on the Node
 * server's runtime rewrite hooks.
 */
test('ftp workflow deploys the static frontend build artifact', async () => {
    const workflow = await readFile(workflowPath, 'utf8')

    assert.match(workflow, /name: Build static frontend deployment/)
    assert.match(workflow, /run: npm run build:static/)
    assert.match(
        workflow,
        /name: Deploy static frontend to \.\/[\s\S]*?local-dir: \.\/\.deploy-src\/[\s\S]*?server-dir: \.\//
    )
    assert.match(
        workflow,
        /name: Retry deploy static frontend to \.\/[\s\S]*?local-dir: \.\/\.deploy-src\/[\s\S]*?server-dir: \.\//
    )
})

/**
 * Verifies the FTP workflow prepares local file dependencies before the static
 * deploy builder copies browser toolkit modules out of node_modules.
 */
test('ftp workflow installs browser build dependencies before static build', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    const toolkitCheckoutIndex = workflow.indexOf(
        'name: Checkout local toolkit dependencies'
    )
    const installIndex = workflow.indexOf(
        'name: Install frontend build dependencies'
    )
    const buildIndex = workflow.indexOf(
        'name: Build static frontend deployment'
    )

    assert.ok(toolkitCheckoutIndex > -1)
    assert.ok(installIndex > toolkitCheckoutIndex)
    assert.ok(buildIndex > installIndex)
    assert.match(
        workflow,
        /git clone --depth 1 https:\/\/github\.com\/SunboX\/altium-toolkit\.git \.\.\/altium-toolkit/
    )
    assert.match(
        workflow,
        /git clone --depth 1 https:\/\/github\.com\/SunboX\/kicad-toolkit\.git \.\.\/kicad-toolkit/
    )
    assert.match(
        workflow,
        /git clone --depth 1 https:\/\/github\.com\/SunboX\/circuitjson-toolkit\.git \.\.\/circuitjson-toolkit/
    )
    assert.match(
        workflow,
        /git clone --depth 1 https:\/\/github\.com\/SunboX\/pcb-scene3d-viewer\.git \.\.\/pcb-scene3d-viewer/
    )
    assert.match(
        workflow,
        /name: Install frontend build dependencies[\s\S]*?run: npm ci/
    )
})

/**
 * Verifies the static artifact upload includes the curated browser dependency
 * files emitted under `.deploy-src/node_modules`.
 */
test('ftp workflow includes static browser node_modules in frontend deploy', async () => {
    const workflow = await readFile(workflowPath, 'utf8')
    const deployBlock = workflow.match(
        /name: Deploy static frontend to \.\/[\s\S]*?state-name: \.ftp-deploy-src-state\.json/
    )?.[0]
    const retryBlock = workflow.match(
        /name: Retry deploy static frontend to \.\/[\s\S]*?state-name: \.ftp-deploy-src-state\.json/
    )?.[0]

    assert.ok(deployBlock)
    assert.ok(retryBlock)
    assert.doesNotMatch(deployBlock, /\*\*\/node_modules\/\*\*/)
    assert.doesNotMatch(retryBlock, /\*\*\/node_modules\/\*\*/)
})

/**
 * Verifies production dependency installs can use the committed lockfile in
 * the FTP deployment workflow.
 */
test('package lock root dependencies match package manifest', async () => {
    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url),
        'utf8'
    )
    const lockRaw = await readFile(
        new URL('../package-lock.json', import.meta.url),
        'utf8'
    )
    const pkg = JSON.parse(packageRaw)
    const lock = JSON.parse(lockRaw)

    assert.deepEqual(lock.packages?.['']?.dependencies, pkg.dependencies)
})
