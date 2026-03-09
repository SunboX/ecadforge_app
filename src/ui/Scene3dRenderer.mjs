/**
 * Renders presentational 3D board summaries.
 */
export class Scene3dRenderer {
    /**
     * Renders a presentational 3D board summary.
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
            '<div class="scene-3d__stage"><div class="scene-3d__shadow"></div><div class="scene-3d__board"><span class="scene-3d__trace scene-3d__trace--one"></span><span class="scene-3d__trace scene-3d__trace--two"></span><span class="scene-3d__trace scene-3d__trace--three"></span></div></div>' +
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
