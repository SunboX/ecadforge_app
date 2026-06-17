/**
 * Renders a modal progress dialog for long-running exports.
 */
export class AppViewExportProgressDialog {
    /** @type {Document} */
    #document

    /** @type {HTMLElement | null} */
    #node

    /** @type {HTMLElement | null} */
    #titleNode

    /** @type {HTMLElement | null} */
    #messageNode

    /** @type {HTMLProgressElement | null} */
    #progressNode

    /**
     * @param {Document} documentRef Browser document.
     */
    constructor(documentRef) {
        this.#document = documentRef
        this.#node = null
        this.#titleNode = null
        this.#messageNode = null
        this.#progressNode = null
    }

    /**
     * Shows the export progress dialog.
     * @param {{ title?: string, message?: string, value?: number }} progress Initial progress state.
     * @returns {void}
     */
    show(progress = {}) {
        if (!this.#node) {
            this.#create()
        }

        this.update(progress)
    }

    /**
     * Updates the visible progress state.
     * @param {{ title?: string, message?: string, value?: number }} progress Progress update.
     * @returns {void}
     */
    update(progress = {}) {
        if (!this.#node) {
            this.#create()
        }

        const title = String(progress.title || '')
        if (title && this.#titleNode) {
            this.#titleNode.textContent = title
        }

        if (this.#messageNode) {
            this.#messageNode.textContent = String(progress.message || '')
        }

        if (this.#progressNode) {
            const value = AppViewExportProgressDialog.#clampProgress(
                progress.value
            )
            this.#progressNode.value = value
            this.#progressNode.max = 100
            this.#progressNode.setAttribute('aria-valuenow', String(value))
        }
    }

    /**
     * Hides and removes the progress dialog.
     * @returns {void}
     */
    hide() {
        this.#node?.remove?.()
        this.#node = null
        this.#titleNode = null
        this.#messageNode = null
        this.#progressNode = null
    }

    /**
     * Creates the dialog DOM.
     * @returns {void}
     */
    #create() {
        const node = this.#document.createElement('div')
        const panel = this.#document.createElement('div')
        const title = this.#document.createElement('h2')
        const message = this.#document.createElement('p')
        const progress = this.#document.createElement('progress')

        node.classList.add('export-progress-dialog')
        node.setAttribute('role', 'dialog')
        node.setAttribute('aria-modal', 'true')
        node.setAttribute('aria-labelledby', 'export-progress-title')

        panel.classList.add('export-progress-dialog__panel')
        title.classList.add('export-progress-dialog__title')
        title.setAttribute('id', 'export-progress-title')
        title.setAttribute('data-export-progress-title', 'true')
        message.classList.add('export-progress-dialog__message')
        message.setAttribute('data-export-progress-message', 'true')
        progress.classList.add('export-progress-dialog__bar')
        progress.setAttribute('data-export-progress-bar', 'true')
        progress.setAttribute('role', 'progressbar')
        progress.setAttribute('aria-valuemin', '0')
        progress.setAttribute('aria-valuemax', '100')
        progress.max = 100
        progress.value = 0

        panel.appendChild(title)
        panel.appendChild(message)
        panel.appendChild(progress)
        node.appendChild(panel)
        this.#registerFakeSelector(node, '[data-export-progress-title]', title)
        this.#registerFakeSelector(
            node,
            '[data-export-progress-message]',
            message
        )
        this.#registerFakeSelector(node, '[data-export-progress-bar]', progress)
        this.#document.body?.appendChild(node)

        this.#node = node
        this.#titleNode = title
        this.#messageNode = message
        this.#progressNode = progress
    }

    /**
     * Registers child selectors on lightweight test fakes when available.
     * @param {HTMLElement} node Root node.
     * @param {string} selector Child selector.
     * @param {HTMLElement} child Child node.
     * @returns {void}
     */
    #registerFakeSelector(node, selector, child) {
        node.registerChild?.(selector, child)
    }

    /**
     * Clamps a progress value to the progress element range.
     * @param {number | undefined} value Candidate progress value.
     * @returns {number}
     */
    static #clampProgress(value) {
        const number = Number(value || 0)
        return Math.min(Math.max(Math.round(number), 0), 100)
    }
}
