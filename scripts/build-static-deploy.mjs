import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StaticDeployBuilder } from '../src/StaticDeployBuilder.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const result = await StaticDeployBuilder.build({
    projectRoot,
    sourceRoot: path.join(projectRoot, 'src'),
    outputRoot: path.join(projectRoot, '.deploy-src')
})

console.log(
    'Static frontend deployment written to ' +
        path.relative(projectRoot, result.outputRoot) +
        ' for version ' +
        result.version
)
