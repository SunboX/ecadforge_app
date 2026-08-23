/**
 * Builds stable identities for cached base PCB SVG markup.
 */
export class PcbBaseSvgCacheKey {
    /**
     * Resolves one side, Gerber selection, and viewport-layer cache key.
     * @param {'top' | 'bottom'} side Active side.
     * @param {{ renderMode: string, layerId: string, layerIds: string[] }} gerberOptions Gerber render options.
     * @param {string[]} [hiddenLayerAliases] Layers excluded from viewport bounds.
     * @returns {string}
     */
    static resolve(side, gerberOptions, hiddenLayerAliases = []) {
        return [
            side,
            String(gerberOptions.renderMode || ''),
            String(gerberOptions.layerId || ''),
            (gerberOptions.layerIds || []).join(','),
            hiddenLayerAliases.map(String).join(',')
        ].join('|')
    }
}
