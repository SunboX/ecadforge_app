/**
 * Renders SVG-local CSS rules for PCB net highlights.
 */
export class PcbNetHighlightCssRenderer {
    /**
     * Renders SVG-local CSS rules for PCB net highlights.
     * @returns {string}
     */
    static render() {
        return (
            '.pcb-svg [data-pcb-net-name] {' +
            ' transition: opacity 120ms ease, stroke 120ms ease, fill 120ms ease; }' +
            '.pcb-svg .pcb-net-highlight {' +
            ' opacity: 1 !important; stroke: rgba(27, 191, 227, 0.94) !important; }' +
            ".pcb-svg .pcb-net-highlight[fill]:not([fill='none']) { fill: rgba(27, 191, 227, 0.38) !important; }"
        )
    }
}
