import assert from 'node:assert/strict'
import test from 'node:test'
import { ServerAssetVersioner } from '../src/ServerAssetVersioner.mjs'

/**
 * Verifies the HTML shell cache-busts every visible app chrome asset.
 */
test('rewriteHtmlDocument versions favicon link and brand image assets', () => {
    const html = [
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
        '<img src="/favicon.svg" alt="" />',
        '<link rel="stylesheet" href="/style.css" />',
        '<script type="module" src="/main.mjs"></script>'
    ].join('\n')

    const rewritten = ServerAssetVersioner.rewriteHtmlDocument(html, '1.4.39')

    assert.match(rewritten, /href="\/favicon\.svg\?v=1\.4\.39"/)
    assert.match(rewritten, /src="\/favicon\.svg\?v=1\.4\.39"/)
    assert.match(rewritten, /href="\/style\.css\?v=1\.4\.39"/)
    assert.match(rewritten, /src="\/main\.mjs\?v=1\.4\.39"/)
})

/**
 * Verifies WebMCP toolkit query services are resolvable in served browser
 * modules, including static builds that cannot rely on Node package exports.
 */
test('rewriteJavaScriptModule versions toolkit netlist query imports', () => {
    const source = [
        "import { LoadedDesignNetlistService } from 'altium-toolkit/netlist-query'",
        "import('kicad-toolkit/netlist-query')",
        "import { CircuitJsonParser } from 'circuitjson-toolkit'",
        "import { GerberProjectLoader } from 'gerber-toolkit/parser'",
        "import('gerber-toolkit/renderers')",
        "import { PcbScene3dBuilder } from 'gerber-toolkit/scene3d'",
        "import { PcbScene3dRuntime } from 'pcb-scene3d-viewer'",
        "import('pcb-scene3d-viewer/scene3d')"
    ].join('\n')

    const rewritten = ServerAssetVersioner.rewriteJavaScriptModule(
        source,
        '1.4.153'
    )

    assert.match(
        rewritten,
        /from '\/node_modules\/altium-toolkit\/src\/netlist-query\.mjs\?v=1\.4\.153'/
    )
    assert.match(
        rewritten,
        /import\('\/node_modules\/kicad-toolkit\/src\/netlist-query\.mjs\?v=1\.4\.153'\)/
    )
    assert.match(
        rewritten,
        /from '\/node_modules\/circuitjson-toolkit\/src\/index\.mjs\?v=1\.4\.153'/
    )
    assert.match(
        rewritten,
        /from '\/node_modules\/gerber-toolkit\/src\/parser\.mjs\?v=1\.4\.153'/
    )
    assert.match(
        rewritten,
        /import\('\/node_modules\/gerber-toolkit\/src\/renderers\.mjs\?v=1\.4\.153'\)/
    )
    assert.match(
        rewritten,
        /from '\/node_modules\/gerber-toolkit\/src\/scene3d\.mjs\?v=1\.4\.153'/
    )
    assert.match(
        rewritten,
        /from '\/node_modules\/pcb-scene3d-viewer\/src\/index\.mjs\?v=1\.4\.153'/
    )
    assert.match(
        rewritten,
        /import\('\/node_modules\/pcb-scene3d-viewer\/src\/scene3d\.mjs\?v=1\.4\.153'\)/
    )
})
