/**
 * Builds and applies PCB Styler crosslink state.
 */
export class PcbStylerLinkState {
    /**
     * Updates the PCB Styler crosslink when a board is available.
     * @param {{ setPcbStylerLink?: (url: string, mode: string) => void }} view App view.
     * @param {string} boardUrl Optional raw board URL.
     * @param {string} mode Link mode.
     * @returns {void}
     */
    static updateView(view, boardUrl, mode) {
        if (typeof view?.setPcbStylerLink !== 'function') {
            return
        }

        view.setPcbStylerLink(PcbStylerLinkState.buildUrl(boardUrl), mode)
    }

    /**
     * Builds the external PCB Styler URL.
     * @param {string} boardUrl Optional raw board URL.
     * @returns {string}
     */
    static buildUrl(boardUrl) {
        return boardUrl
            ? 'https://pcb-styler.app/?url=' + encodeURIComponent(boardUrl)
            : 'https://pcb-styler.app/'
    }
}
