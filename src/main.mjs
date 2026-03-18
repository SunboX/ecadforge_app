import { AppController } from './AppController.mjs'
import { AppRuntimeVersion } from './AppRuntimeVersion.mjs'
import { AppState } from './core/AppState.mjs'
import { AppView } from './ui/AppView.mjs'
import { I18nService } from './I18n.mjs'
import { WorkerUrlBuilder } from './WorkerUrlBuilder.mjs'

/**
 * App bootstrap.
 */
async function bootstrap() {
    const loadedVersion = AppRuntimeVersion.readLoadedVersion(import.meta.url)
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
    view.setVersion(loadedVersion)
    const parserWorkerUrl = WorkerUrlBuilder.buildParserWorkerUrl(
        import.meta.url,
        Date.now()
    )
    const controller = new AppController({
        state,
        view,
        i18n,
        workerFactory: () =>
            new Worker(
                parserWorkerUrl,
                { type: 'module' }
            )
    })

    await controller.init()

    await loadVersion(view, loadedVersion)
}

/**
 * Loads the app version and updates the header.
 * @param {import('./ui/AppView.mjs').AppView} view
 * @param {string} loadedVersion
 */
async function loadVersion(view, loadedVersion) {
    try {
        const response = await fetch('/api/app-meta', { cache: 'no-store' })
        if (!response.ok) {
            view.setVersion(
                AppRuntimeVersion.resolveDisplayVersion(loadedVersion, '')
            )
            return
        }

        const payload = await response.json()
        const serverVersion = String(payload.version || '').trim()

        view.setVersion(
            AppRuntimeVersion.resolveDisplayVersion(
                loadedVersion,
                serverVersion
            )
        )

        if (
            AppRuntimeVersion.shouldReloadForStaleModules(
                loadedVersion,
                serverVersion
            )
        ) {
            view.setStatus('Refreshing viewer to load the latest renderer...')

            if (typeof window !== 'undefined') {
                window.location.reload()
            }
        }
    } catch (_error) {
        view.setVersion(
            AppRuntimeVersion.resolveDisplayVersion(loadedVersion, '')
        )
    }
}

bootstrap().catch((error) => {
    console.error('App bootstrap failed:', error)
})
