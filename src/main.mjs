import { AppController } from './AppController.mjs'
import { AppState } from './core/AppState.mjs'
import { AppView } from './ui/AppView.mjs'
import { I18nService } from './I18n.mjs'

/**
 * App bootstrap.
 */
async function bootstrap() {
    const i18n = await I18nService.create('en')
    const state = new AppState({
        locale: i18n ? i18n.getLocale() : 'en',
        activeView: 'schematic',
        parseStatus: 'idle',
        statusMessage: i18n
            ? i18n.translate('status.ready')
            : 'Drop a native SchDoc or PcbDoc file to begin.'
    })

    const view = new AppView(document)
    const controller = new AppController({
        state,
        view,
        i18n,
        workerFactory: () =>
            new Worker(
                new URL('./workers/altium-parser.worker.mjs', import.meta.url),
                { type: 'module' }
            )
    })

    await controller.init()

    await loadVersion(view)
}

/**
 * Loads the app version and updates the header.
 * @param {import('./ui/AppView.mjs').AppView} view
 */
async function loadVersion(view) {
    try {
        const response = await fetch('/api/app-meta', { cache: 'no-store' })
        if (!response.ok) {
            view.setVersion('')
            return
        }

        const payload = await response.json()
        view.setVersion(String(payload.version || '').trim())
    } catch (_error) {
        view.setVersion('')
    }
}

bootstrap().catch((error) => {
    console.error('App bootstrap failed:', error)
})
