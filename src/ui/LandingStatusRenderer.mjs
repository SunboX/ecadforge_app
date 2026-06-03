/**
 * Renders landing-page intake feedback near the opening controls.
 */
export class LandingStatusRenderer {
    /**
     * Updates one landing status node from an app state snapshot.
     * @param {HTMLElement | null} statusNode Landing status node.
     * @param {{ parseStatus: string, statusMessage: string, documentModel: any }} snapshot App state snapshot.
     * @returns {void}
     */
    static render(statusNode, snapshot) {
        if (!statusNode) {
            return
        }

        const status = String(snapshot.parseStatus || '')
        const message = String(snapshot.statusMessage || '').trim()
        const shouldShow =
            !snapshot.documentModel &&
            ['error', 'loading'].includes(status) &&
            Boolean(message)

        if (!shouldShow) {
            statusNode.textContent = ''
            statusNode.setAttribute('hidden', 'hidden')
            statusNode.removeAttribute('data-status')
            return
        }

        statusNode.textContent = message
        statusNode.setAttribute('data-status', status)
        statusNode.removeAttribute('hidden')
    }
}
