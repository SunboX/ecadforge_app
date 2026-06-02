import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { I18nService } from '../src/I18n.mjs'
import { Scene3dRenderer } from '../src/ui/Scene3dRenderer.mjs'
import { SummaryCardRenderer } from '../src/ui/SummaryCardRenderer.mjs'
import { ViewerEmptyStateRenderer } from '../src/ui/ViewerEmptyStateRenderer.mjs'

const root = new URL('../', import.meta.url)

/**
 * Minimal fake node for i18n DOM application tests.
 */
class FakeI18nNode {
    /** @type {Map<string, string>} */
    #attributes

    constructor(attributes = {}) {
        this.#attributes = new Map(Object.entries(attributes))
        this.textContent = ''
    }

    /**
     * Returns one attribute value.
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }
}

/**
 * Minimal fake document that exposes i18n nodes by selector.
 */
class FakeI18nDocument {
    constructor() {
        this.documentElement = new FakeI18nNode()
        this.#textNodes = [new FakeI18nNode({ 'data-i18n': 'footer.title' })]
        this.#attributeNodes = [
            new FakeI18nNode({
                'data-i18n-attr':
                    'aria-label:footer.githubAria,title:footer.githubTitle'
            })
        ]
    }

    /** @type {FakeI18nNode[]} */
    #textNodes

    /** @type {FakeI18nNode[]} */
    #attributeNodes

    /**
     * Returns the nodes matching one simple i18n selector.
     * @param {string} selector
     * @returns {FakeI18nNode[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-i18n]') {
            return this.#textNodes
        }
        if (selector === '[data-i18n-attr]') {
            return this.#attributeNodes
        }
        return []
    }

    /**
     * Returns the first fake text node.
     * @returns {FakeI18nNode}
     */
    getTextNode() {
        return this.#textNodes[0]
    }

    /**
     * Returns the first fake attribute node.
     * @returns {FakeI18nNode}
     */
    getAttributeNode() {
        return this.#attributeNodes[0]
    }
}

/**
 * Minimal localStorage-compatible fake for locale persistence tests.
 */
class FakeLocaleStorage {
    /** @type {Map<string, string>} */
    #entries

    constructor(entries = {}) {
        this.#entries = new Map(Object.entries(entries))
    }

    /**
     * Reads one stored value.
     * @param {string} key
     * @returns {string | null}
     */
    getItem(key) {
        return this.#entries.get(key) || null
    }

    /**
     * Stores one string value.
     * @param {string} key
     * @param {string} value
     * @returns {void}
     */
    setItem(key, value) {
        this.#entries.set(key, String(value))
    }
}

/**
 * Verifies locale application updates text and translated attributes.
 */
test('I18nService applies translated text and attributes to the DOM', () => {
    const documentRef = new FakeI18nDocument()
    const service = new I18nService('de', {
        'footer.title': 'Impressum',
        'footer.githubAria': 'GitHub-Repository',
        'footer.githubTitle': 'GitHub'
    })

    service.applyToDom(documentRef)

    assert.equal(documentRef.documentElement.lang, 'de')
    assert.equal(documentRef.getTextNode().textContent, 'Impressum')
    assert.equal(
        documentRef.getAttributeNode().getAttribute('aria-label'),
        'GitHub-Repository'
    )
    assert.equal(documentRef.getAttributeNode().getAttribute('title'), 'GitHub')
})

/**
 * Verifies visible German app copy uses native umlauts instead of ASCII
 * transliterations.
 */
test('German locale uses native umlauts in visible app copy', async () => {
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')
    const germanMessages = JSON.parse(germanRaw)

    assert.equal(
        germanMessages['app.subtitle'],
        'Privater ECAD-Viewer für Altium & KiCad.'
    )
    assert.equal(germanMessages['app.open'], 'Lokale Dateien öffnen')
    assert.equal(germanMessages['app.openFolder'], 'Ordner öffnen')
    assert.equal(
        germanMessages['app.dropCopy'],
        'Schaltpläne, PCB-Layouts, 3D-Boards, BOMs und Diagnosen direkt im Browser ansehen. Kein Upload, kein Account, keine serverseitige Vorverarbeitung.'
    )
    assert.match(germanMessages['status.loaded'], /für PCB/)
    assert.match(germanMessages['status.invalidFile'], /unterstützt/)
    assert.match(germanMessages['status.invalidFile'], /ausgewählte/)
    assert.match(germanMessages['status.invalidFile'], /öffne/)
    assert.match(germanMessages['status.assetsAdded'], /hinzugefügt/)
})

/**
 * Verifies non-default locale selection loads the matching bundles.
 */
test('I18nService creates requested non-default locale services', async () => {
    const localeCases = [
        ['zh-CN', '打开本地文件'],
        ['vi', 'Mở tệp cục bộ'],
        ['fr', 'Ouvrir des fichiers locaux'],
        ['es', 'Abrir archivos locales'],
        ['pt-BR', 'Abrir arquivos locais']
    ]
    const requestedUrls = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
        const requestedUrl = String(url)
        const locale = requestedUrl.replace('/i18n/', '').replace('.json', '')
        const localizedOpen =
            localeCases.find(([caseLocale]) => caseLocale === locale)?.[1] || ''
        requestedUrls.push(requestedUrl)
        return {
            ok: true,
            async json() {
                return {
                    'app.open': localizedOpen
                }
            }
        }
    }

    try {
        for (const [locale, localizedOpen] of localeCases) {
            const service = await I18nService.create(locale)

            assert.equal(service.getLocale(), locale)
            assert.equal(service.translate('app.open'), localizedOpen)
        }
        assert.deepEqual(
            requestedUrls,
            localeCases.map(([locale]) => '/i18n/' + locale + '.json')
        )
    } finally {
        globalThis.fetch = originalFetch
    }
})

/**
 * Verifies stored locale preference is used during service creation.
 */
test('I18nService restores the stored browser locale', async () => {
    const storage = new FakeLocaleStorage({ 'ecadforge.locale': 'fr' })
    const requestedUrls = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
        requestedUrls.push(String(url))
        return {
            ok: true,
            async json() {
                return {
                    'app.open': 'Ouvrir des fichiers locaux'
                }
            }
        }
    }

    try {
        const service = await I18nService.createFromBrowserStorage(storage)

        assert.equal(service.getLocale(), 'fr')
        assert.equal(
            service.translate('app.open'),
            'Ouvrir des fichiers locaux'
        )
        assert.deepEqual(requestedUrls, ['/i18n/fr.json'])
    } finally {
        globalThis.fetch = originalFetch
    }
})

/**
 * Verifies browser language detection is used when no stored preference exists.
 */
test('I18nService detects the browser locale when no stored preference exists', async () => {
    const storage = new FakeLocaleStorage()
    const requestedUrls = []
    const originalFetch = globalThis.fetch
    const originalNavigator = Object.getOwnPropertyDescriptor(
        globalThis,
        'navigator'
    )
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            languages: ['pt-BR', 'de-DE'],
            language: 'de-DE'
        }
    })
    globalThis.fetch = async (url) => {
        requestedUrls.push(String(url))
        return {
            ok: true,
            async json() {
                return {
                    'app.open': 'Abrir arquivos locais'
                }
            }
        }
    }

    try {
        const service = await I18nService.createFromBrowserStorage(storage)

        assert.equal(service.getLocale(), 'pt-BR')
        assert.equal(service.translate('app.open'), 'Abrir arquivos locais')
        assert.deepEqual(requestedUrls, ['/i18n/pt-BR.json'])
    } finally {
        globalThis.fetch = originalFetch
        if (originalNavigator) {
            Object.defineProperty(globalThis, 'navigator', originalNavigator)
        } else {
            delete globalThis.navigator
        }
    }
})

/**
 * Verifies explicit user language selection wins over browser detection.
 */
test('I18nService prefers the stored locale over browser detection', async () => {
    const storage = new FakeLocaleStorage({ 'ecadforge.locale': 'en' })
    const requestedUrls = []
    const originalFetch = globalThis.fetch
    const originalNavigator = Object.getOwnPropertyDescriptor(
        globalThis,
        'navigator'
    )
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            languages: ['pt-BR'],
            language: 'pt-BR'
        }
    })
    globalThis.fetch = async (url) => {
        requestedUrls.push(String(url))
        return {
            ok: true,
            async json() {
                return {
                    'app.open': 'Open local files'
                }
            }
        }
    }

    try {
        const service = await I18nService.createFromBrowserStorage(storage)

        assert.equal(service.getLocale(), 'en')
        assert.equal(service.translate('app.open'), 'Open local files')
        assert.deepEqual(requestedUrls, ['/i18n/en.json'])
    } finally {
        globalThis.fetch = originalFetch
        if (originalNavigator) {
            Object.defineProperty(globalThis, 'navigator', originalNavigator)
        } else {
            delete globalThis.navigator
        }
    }
})

/**
 * Verifies unsupported browser languages fall back to English.
 */
test('I18nService falls back to English for unsupported browser locales', async () => {
    const storage = new FakeLocaleStorage()
    const requestedUrls = []
    const originalFetch = globalThis.fetch
    const originalNavigator = Object.getOwnPropertyDescriptor(
        globalThis,
        'navigator'
    )
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            languages: ['it-IT', 'nl-NL'],
            language: 'it-IT'
        }
    })
    globalThis.fetch = async (url) => {
        requestedUrls.push(String(url))
        return {
            ok: true,
            async json() {
                return {
                    'app.open': 'Open local files'
                }
            }
        }
    }

    try {
        const service = await I18nService.createFromBrowserStorage(storage)

        assert.equal(service.getLocale(), 'en')
        assert.equal(service.translate('app.open'), 'Open local files')
        assert.deepEqual(requestedUrls, ['/i18n/en.json'])
    } finally {
        globalThis.fetch = originalFetch
        if (originalNavigator) {
            Object.defineProperty(globalThis, 'navigator', originalNavigator)
        } else {
            delete globalThis.navigator
        }
    }
})

/**
 * Verifies user-selected locale changes are written to browser storage.
 */
test('I18nService stores selected browser locale changes', async () => {
    const storage = new FakeLocaleStorage()
    const documentRef = new FakeI18nDocument()
    const originalFetch = globalThis.fetch
    const originalDocument = globalThis.document
    globalThis.fetch = async () => ({
        ok: true,
        async json() {
            return {
                'footer.title': 'Impressum'
            }
        }
    })
    globalThis.document = documentRef

    try {
        const service = new I18nService('en', {}, storage)

        await service.setLocale('de')

        assert.equal(storage.getItem('ecadforge.locale'), 'de')
        assert.equal(service.getLocale(), 'de')
        assert.equal(documentRef.documentElement.lang, 'de')
    } finally {
        globalThis.fetch = originalFetch
        if (originalDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
    }
})

/**
 * Verifies the app template exposes every added locale in the selector.
 */
test('index template exposes every localized locale option', async () => {
    const html = await readFile(new URL('src/index.html', root), 'utf8')
    const optionLocales = Array.from(
        html.matchAll(/<option value="([^"]+)" data-i18n="locale\.[^"]+">/g),
        (match) => match[1]
    )

    ;['zh-CN', 'vi', 'fr', 'es', 'pt-BR'].forEach((locale) => {
        assert.match(
            html,
            new RegExp(
                '<option value="' +
                    locale +
                    '" data-i18n="locale\\.' +
                    locale +
                    '">'
            )
        )
    })
    assert.deepEqual(optionLocales, [
        'de',
        'en',
        'es',
        'fr',
        'pt-BR',
        'vi',
        'zh-CN'
    ])
})

/**
 * Verifies visible landing-page chrome is wired through the translation
 * service rather than remaining hard-coded English.
 */
test('index template localizes visible landing and viewer chrome', async () => {
    const html = await readFile(new URL('src/index.html', root), 'utf8')
    const expectedMarkers = [
        'data-i18n="preview.eyebrow"',
        'data-i18n="preview.supportedViews"',
        'data-i18n="action.tryKicad"',
        'data-i18n="action.tryAltium"',
        'data-i18n="github.label"',
        'data-i18n="github.open"',
        'data-i18n="chip.noAccount"',
        'data-i18n="trust.localParsing"',
        'data-i18n="link.supportedFormats"',
        'data-i18n="view.schematic"',
        'data-i18n="viewStatus.ready"',
        'data-i18n="summary.noFile"',
        'data-i18n="summary.records"',
        'data-i18n="pcbStyler.prompt"',
        'data-i18n="pcbStyler.open"',
        'data-i18n-attr="aria-label:pcbStyler.dismiss,title:pcbStyler.dismiss"'
    ]

    expectedMarkers.forEach((marker) => {
        assert.match(html, new RegExp(marker))
    })
})

/**
 * Verifies renderer-owned landing and viewer text accepts localized copy.
 */
test('dynamic viewer renderers use provided translations', () => {
    const translations = {
        'empty.title': '将设计文件拖到这里，或从示例项目开始',
        'empty.copy':
            '支持 .SchDoc、.PcbDoc、.PrjPcb、.kicad_pro 和 .kicad_pcb。你的文件保留在你的设备上。',
        'action.tryKicad': '试用 KiCad 示例',
        'action.tryAltium': '试用 Altium 示例',
        'app.open': '打开本地文件',
        'summary.status': '状态',
        'summary.waitingForFile': '等待文件',
        'summary.formats': '格式',
        'summary.parser': '解析器',
        'summary.clientSideJs': '客户端 JS',
        'summary.views': '视图',
        'summary.tabsReady': '5 个标签页就绪',
        'scene3d.title': '3D 预览',
        'scene3d.boardEnvelopeSuffix': 'mil 板外形',
        'scene3d.top': '顶面',
        'scene3d.bottom': '底面',
        'scene3d.isometric': '等轴测',
        'scene3d.downloadModelsZip': '下载模型 ZIP',
        'scene3d.loading': '正在准备 3D 场景...',
        'scene3d.externalModels': '外部模型',
        'scene3d.fallbackBodies': '备用实体',
        'scene3d.copperDetail': '铜层细节',
        'scene3d.componentInspector': '元件检查器',
        'scene3d.inspectPrompt': '点击元件进行检查。',
        'scene3d.companionModelsHint':
            '加载匹配的 WRL 或 STEP 文件后，将使用配套模型。',
        'summary.placements': '贴装',
        'summary.bomGroups': 'BOM 分组',
        'scene3d.componentsSuffix': '个元件'
    }
    const translate = (key) => translations[key] || key
    const emptyHtml = ViewerEmptyStateRenderer.render(translate)
    const summaryHtml = SummaryCardRenderer.render(null, translate)
    const sceneHtml = Scene3dRenderer.render(
        {
            pcb: {
                boardOutline: { widthMil: 1200, heightMil: 800 },
                components: [{ designator: 'U1' }, { designator: 'R1' }]
            },
            bom: [{ quantity: 2 }]
        },
        translate
    )

    assert.match(emptyHtml, /将设计文件拖到这里/)
    assert.doesNotMatch(emptyHtml, /Drop a design file here/)
    assert.match(summaryHtml, /等待文件/)
    assert.doesNotMatch(summaryHtml, /Waiting for file/)
    assert.match(sceneHtml, /正在准备 3D 场景/)
    assert.match(sceneHtml, /顶面/)
    assert.doesNotMatch(sceneHtml, /Preparing 3D scene/)
})

/**
 * Verifies added translations stay aligned with the base locale.
 */
test('added locales mirror English translation keys', async () => {
    const englishRaw = await readFile(new URL('src/i18n/en.json', root), 'utf8')
    const englishMessages = JSON.parse(englishRaw)
    const localeCases = [
        ['zh-CN', '简体中文', '打开本地文件'],
        ['vi', 'Tiếng Việt', 'Mở tệp cục bộ'],
        ['fr', 'Français', 'Ouvrir des fichiers locaux'],
        ['es', 'Español', 'Abrir archivos locales'],
        ['pt-BR', 'Português (Brasil)', 'Abrir arquivos locais']
    ]

    for (const [locale, localeLabel, localizedOpen] of localeCases) {
        const localizedRaw = await readFile(
            new URL('src/i18n/' + locale + '.json', root),
            'utf8'
        )
        const localizedMessages = JSON.parse(localizedRaw)

        assert.deepEqual(
            Object.keys(localizedMessages).sort(),
            Object.keys(englishMessages).sort()
        )
        assert.equal(localizedMessages['locale.' + locale], localeLabel)
        assert.equal(localizedMessages['app.open'], localizedOpen)
    }
})
