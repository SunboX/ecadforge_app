/**
 * Renders the interactive 3D scene shell.
 */
export class Scene3dRenderer {
    /**
     * Renders the interactive 3D scene shell.
     * @param {{ pcb?: { boardOutline: { widthMil: number, heightMil: number }, components: { designator: string }[] }, bom: { quantity: number }[] }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return '<section class="viewer-empty">3D preview is available after loading a PCB document.</section>'
        }

        const widthMil = Math.round(pcb.boardOutline.widthMil || 0)
        const heightMil = Math.round(pcb.boardOutline.heightMil || 0)
        const componentCount = pcb.components.length
        const bomRows = documentModel?.bom?.length || 0

        return (
            '<section class="scene-3d"><header class="svg-panel__header"><h3>3D preview</h3><p>' +
            widthMil +
            ' x ' +
            heightMil +
            ' mil board envelope</p></header>' +
            '<div class="scene-3d__toolbar" aria-label="3D camera presets">' +
            '<button class="scene-3d__preset" type="button" data-scene-3d-preset="top">Top</button>' +
            '<button class="scene-3d__preset" type="button" data-scene-3d-preset="bottom">Bottom</button>' +
            '<button class="scene-3d__preset" type="button" data-scene-3d-preset="isometric">Isometric</button>' +
            '<button class="scene-3d__preset scene-3d__action" type="button" data-scene-3d-export="models-zip">Download Models ZIP</button>' +
            '</div>' +
            '<div class="scene-3d__stage">' +
            '<div class="scene-3d__viewport" aria-label="Interactive 3D PCB view">' +
            '<div class="scene-3d__canvas-mount" data-scene-3d-viewport></div>' +
            '<div class="scene-3d__loading" data-scene-3d-loading aria-live="polite">' +
            '<div class="scene-3d__loading-content"><div class="viewer-loading__pulse"></div><p>Preparing 3D scene...</p></div></div>' +
            '</div>' +
            '<aside class="scene-3d__controls" aria-label="3D detail toggles">' +
            '<label class="scene-3d__toggle"><input type="checkbox" checked data-scene-3d-toggle="external-models" />External models</label>' +
            '<label class="scene-3d__toggle"><input type="checkbox" data-scene-3d-toggle="fallback-bodies" />Fallback bodies</label>' +
            '<label class="scene-3d__toggle"><input type="checkbox" checked data-scene-3d-toggle="copper" />Copper detail</label>' +
            '<section class="scene-3d__selection" aria-live="polite"><h4 class="scene-3d__selection-title">Component inspector</h4><p class="scene-3d__selection-empty">Click a component to inspect it.</p></section>' +
            '</aside>' +
            '</div>' +
            '<div class="scene-3d__diagnostics" aria-live="polite">Companion models will be used when matching WRL or STEP files are loaded in the session.</div>' +
            '<dl class="scene-3d__stats"><div><dt>Footprint</dt><dd>' +
            widthMil +
            ' x ' +
            heightMil +
            ' mil</dd></div><div><dt>Placements</dt><dd>' +
            componentCount +
            ' components</dd></div><div><dt>BOM groups</dt><dd>' +
            bomRows +
            '</dd></div></dl></section>'
        )
    }
}
