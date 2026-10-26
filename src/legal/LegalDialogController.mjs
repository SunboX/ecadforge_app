/** Opens authored legal documents without navigating away from the current design. */
export class LegalDialogController {
    #document
    #window
    #dialog = null
    #frame = null
    #title = null
    #returnFocus = null
    #previousOverflow = ''

    /** Use the host document so the same small controller works on landing pages. */
    constructor(documentObject = document, windowObject = window) {
        this.#document = documentObject
        this.#window = windowObject
    }

    /** Delegate authored legal links; embedded documents are managed by their parent. */
    initialize() {
        if (this.#window.frameElement?.hasAttribute('data-legal-frame')) return
        this.#document.addEventListener('click', (event) =>
            this.#handleLink(event)
        )
    }

    /** Open or switch the document in one modal, preserving the original opener. */
    open(href, label, opener = this.#document.activeElement) {
        const url = new URL(href, this.#window.location.href)
        if (url.origin !== this.#window.location.origin) return false
        this.#create()
        if (!this.#dialog.open) {
            this.#returnFocus = opener
            this.#previousOverflow =
                this.#document.documentElement.style.overflow
            this.#document.documentElement.style.overflow = 'hidden'
            this.#dialog.showModal()
        }
        this.#title.textContent =
            label || 'Legal information / Rechtliche Informationen'
        this.#frame.title = this.#title.textContent
        this.#frame.dataset.legalLanguage =
            this.#frame.contentDocument?.documentElement.lang ||
            this.#document.documentElement.lang ||
            'de'
        this.#frame.src = url.href
        return true
    }

    /** Close every dismissal path in the same way and restore the viewer's focus. */
    close() {
        if (!this.#dialog?.open) return
        this.#dialog.close()
        this.#frame.src = 'about:blank'
        this.#document.documentElement.style.overflow = this.#previousOverflow
        this.#returnFocus?.focus?.({ preventScroll: true })
    }

    /** Keep ordinary links and explicit modified-click browser actions intact. */
    #handleLink(event, embedded = false) {
        if (embedded) this.#syncTitle(this.#frame.contentDocument)
        if (
            event.defaultPrevented ||
            event.button > 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        )
            return
        const anchor = event.target?.closest?.('a[href]')
        if (!anchor) return
        const url = new URL(
            anchor.getAttribute('href'),
            embedded ? this.#frame.src : this.#window.location.href
        )
        if (url.origin !== this.#window.location.origin) return
        if (
            embedded &&
            url.pathname === '/' &&
            url.searchParams.get('privacy') === 'analytics'
        ) {
            event.preventDefault()
            this.close()
            this.#window.dispatchEvent(
                new this.#window.Event('ecadforge:analytics-settings')
            )
            return
        }
        if (
            embedded &&
            (url.pathname === '/' || url.pathname === '/index.html')
        ) {
            event.preventDefault()
            this.close()
            return
        }
        if (!anchor.hasAttribute('data-legal-document')) return
        event.preventDefault()
        this.open(
            url.href,
            (anchor.innerText || anchor.textContent).trim(),
            embedded ? this.#returnFocus : anchor
        )
    }

    /** Build a native dialog with keyboard focus containment and a persistent close action. */
    #create() {
        if (this.#dialog) return
        const dialog = this.#document.createElement('dialog')
        dialog.className = 'legal-dialog'
        dialog.setAttribute('data-legal-dialog', '')
        dialog.setAttribute('aria-labelledby', 'legal-dialog-title')
        const header = this.#document.createElement('header')
        header.className = 'legal-dialog__header'
        this.#title = this.#document.createElement('h2')
        this.#title.id = 'legal-dialog-title'
        const close = this.#document.createElement('button')
        close.type = 'button'
        close.className = 'legal-dialog__close'
        close.setAttribute('aria-label', 'Close / Schließen')
        close.setAttribute('autofocus', '')
        close.addEventListener('click', () => this.close())
        header.append(this.#title, close)
        this.#frame = this.#document.createElement('iframe')
        this.#frame.className = 'legal-dialog__frame'
        this.#frame.setAttribute('data-legal-frame', '')
        this.#frame.referrerPolicy = 'no-referrer'
        this.#frame.addEventListener('load', () => this.#bindFrame())
        dialog.append(header, this.#frame)
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault()
            this.close()
        })
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) this.close()
        })
        this.#document.body.append(dialog)
        this.#dialog = dialog
    }

    /** Rebind internal navigation and Escape after each same-origin frame load. */
    #bindFrame() {
        const content = this.#frame.contentDocument
        if (!content || this.#frame.src === 'about:blank') return
        this.#syncTitle(content)
        content.addEventListener('click', (event) =>
            this.#handleLink(event, true)
        )
        content.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            this.close()
        })
        const theme = this.#document.documentElement.dataset.theme
        if (theme) content.documentElement.dataset.theme = theme
    }

    /** Mirror the selected document language in the outer dialog's accessible title. */
    #syncTitle(content) {
        const heading = content?.querySelector?.('[data-legal-title]')
        if (!heading) return
        this.#title.textContent = heading.textContent
        this.#frame.title = heading.textContent
    }
}
