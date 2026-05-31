import { AppController } from './AppController.mjs'
import { HeroPreviewDemoLoader } from './HeroPreviewDemoLoader.mjs'
import { AppMetaLoader } from './AppMetaLoader.mjs'
import { AppRuntimeVersion } from './AppRuntimeVersion.mjs'
import { AppState } from './core/AppState.mjs'
import { AppView } from './ui/AppView.mjs'
import { PcbScene3dController } from './ui/PcbScene3dController.mjs'
import { PcbScene3dWorkerClient } from './ui/PcbScene3dWorkerClient.mjs'
import { I18nService } from './I18n.mjs'
import { StartupSourceResolver } from './StartupSourceResolver.mjs'
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
            : 'Drop .PcbDoc, .SchDoc, .kicad_pcb or KiCad project files here. Files are processed locally in your browser.'
    })

    const parserWorkerUrl = WorkerUrlBuilder.buildParserWorkerUrl(
        import.meta.url,
        Date.now()
    )
    const scene3dWorkerUrl = WorkerUrlBuilder.buildScene3dWorkerUrl(
        import.meta.url,
        Date.now()
    )
    const view = new AppView(document, {
        createScene3dController: (viewportNode, documentModel, options = {}) =>
            new PcbScene3dController(viewportNode, documentModel, {
                ...options,
                scenePrepClient: new PcbScene3dWorkerClient(
                    () => new Worker(scene3dWorkerUrl, { type: 'module' })
                )
            }),
        translate: (key) => i18n.translate(key)
    })
    view.setVersion(loadedVersion)
    const startupSource = StartupSourceResolver.resolve(window.location.href)
    const controller = new AppController({
        state,
        view,
        i18n,
        workerFactory: () => new Worker(parserWorkerUrl, { type: 'module' }),
        startupSource
    })

    await controller.init()
    if (!startupSource) {
        void HeroPreviewDemoLoader.load(view)
    }

    await loadVersion(view, loadedVersion, i18n)
    startVersionRefreshLoop(view, loadedVersion, i18n)
}

/**
 * Loads the app version and updates the header.
 * @param {import('./ui/AppView.mjs').AppView} view
 * @param {string} loadedVersion
 * @param {{ translate: (key: string) => string }} i18n Translation service.
 * @returns {Promise<boolean>}
 */
async function loadVersion(view, loadedVersion, i18n) {
    try {
        const serverVersion = await AppMetaLoader.loadVersion()

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
            view.setStatus(i18n.translate('status.refreshing'))

            if (typeof window !== 'undefined') {
                window.location.replace(
                    AppRuntimeVersion.buildReloadUrl(
                        window.location.href,
                        serverVersion
                    )
                )
            }

            return true
        }
    } catch (_error) {
        view.setVersion(
            AppRuntimeVersion.resolveDisplayVersion(loadedVersion, '')
        )
    }

    return false
}

/**
 * Rechecks the served version while the tab stays open so long-lived sessions
 * cannot keep stale renderer modules after local edits or deploys.
 * @param {import('./ui/AppView.mjs').AppView} view
 * @param {string} loadedVersion
 * @param {{ translate: (key: string) => string }} i18n Translation service.
 * @returns {void}
 */
const startVersionRefreshLoop = (view, loadedVersion, i18n) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return
    }

    let isChecking = false
    let reloadRequested = false
    const refreshVersion = async () => {
        if (isChecking || reloadRequested) {
            return
        }

        isChecking = true
        try {
            reloadRequested = await loadVersion(view, loadedVersion, i18n)
        } finally {
            isChecking = false
        }
    }

    window.setInterval(refreshVersion, 15000)
    window.addEventListener('focus', () => {
        refreshVersion()
    })
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshVersion()
        }
    })
}

bootstrap().catch((error) => {
    console.error('App bootstrap failed:', error)
})
