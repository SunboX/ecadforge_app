/**
 * Renders landing-page intake feedback near the opening controls.
 */
export class LandingStatusRenderer {
    /**
     * Returns whether the landing status owns the current state message.
     * @param {{ parseStatus: string, statusMessage: string, documentModel: any }} snapshot App state snapshot.
     * @returns {boolean}
     */
    static shouldShow(snapshot) {
        const status = String(snapshot.parseStatus || '')
        const message = String(snapshot.statusMessage || '').trim()

        return (
            !snapshot.documentModel &&
            ['error', 'loading'].includes(status) &&
            Boolean(message)
        )
    }

    /**
     * Updates the persistent landing info/status node without duplicating
     * messages already shown by the landing intake banner.
     * @param {HTMLElement | null} statusNode Persistent status node.
     * @param {{ parseStatus: string, statusMessage: string, documentModel: any }} snapshot App state snapshot.
     * @returns {void}
     */
    static renderPersistentStatus(statusNode, snapshot) {
        if (!statusNode) {
            return
        }

        if (LandingStatusRenderer.shouldShow(snapshot)) {
            statusNode.textContent = ''
            statusNode.setAttribute('hidden', 'hidden')
            return
        }

        statusNode.textContent = snapshot.statusMessage
        statusNode.removeAttribute('hidden')
    }

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
        const shouldShow = LandingStatusRenderer.shouldShow(snapshot)

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
