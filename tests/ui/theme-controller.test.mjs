import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

const source = await readFile(
    new URL('../../src/ThemeController.mjs', import.meta.url),
    'utf8'
)

/** Creates browser boundaries and runs the actual pre-paint theme bootstrap. */
function createBrowser({
    dark = false,
    stored = null,
    media = true,
    blocked = false,
    legacy = false
} = {}) {
    const values = new Map(stored === null ? [] : [['ecadforge.theme', stored]])
    const document = new EventTarget()
    const window = new EventTarget()
    const toggle = new EventTarget()
    toggle.checked = false
    document.documentElement = { dataset: {}, style: {} }
    document.readyState = 'loading'
    document.getElementById = (id) => (id === 'themeToggle' ? toggle : null)
    const storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            if (blocked) throw new Error('Storage blocked')
            values.set(key, value)
        }
    }
    Object.defineProperty(window, 'localStorage', {
        get: () => {
            if (blocked) throw new Error('Storage blocked')
            return storage
        }
    })
    const query = new EventTarget()
    query.matches = dark
    if (legacy) {
        query.addListener = (listener) =>
            EventTarget.prototype.addEventListener.call(
                query,
                'change',
                listener
            )
        query.addEventListener = undefined
    }
    if (media)
        window.matchMedia = (value) => {
            assert.equal(value, '(prefers-color-scheme: dark)')
            return query
        }
    vm.runInNewContext(source, { document, window })
    return {
        document,
        window,
        toggle,
        values,
        storage,
        ready() {
            document.dispatchEvent(new Event('DOMContentLoaded'))
        },
        system(value) {
            query.matches = value
            query.dispatchEvent(new Event('change'))
        },
        choose(value) {
            toggle.checked = value
            toggle.dispatchEvent(new Event('change'))
        }
    }
}

test('applies the system palette before DOM content is ready without saving an override', () => {
    for (const [dark, expected] of [
        [true, 'dark'],
        [false, 'light']
    ]) {
        const browser = createBrowser({ dark })
        assert.equal(browser.document.documentElement.dataset.theme, expected)
        assert.equal(
            browser.document.documentElement.style.colorScheme,
            expected
        )
        assert.equal(browser.values.size, 0)
        browser.ready()
        assert.equal(browser.toggle.checked, dark)
    }
})

test('falls back to light without matchMedia and ignores invalid saved preferences', () => {
    const browser = createBrowser({ media: false, stored: 'invalid' })
    assert.equal(browser.document.documentElement.dataset.theme, 'light')
    const darkBrowser = createBrowser({ dark: true, stored: 'invalid' })
    assert.equal(darkBrowser.document.documentElement.dataset.theme, 'dark')
})

test('manual choices survive a new browser session and override the system in both directions', () => {
    for (const chosen of [true, false]) {
        const browser = createBrowser({ dark: !chosen })
        browser.ready()
        browser.choose(chosen)
        assert.equal(
            browser.document.documentElement.dataset.theme,
            chosen ? 'dark' : 'light'
        )
        const saved = browser.values.get('ecadforge.theme')
        assert.equal(saved, chosen ? 'dark' : 'light')
        const reopened = createBrowser({ dark: !chosen, stored: saved })
        reopened.ready()
        assert.equal(reopened.toggle.checked, chosen)
    }
})

test('follows system changes only until a manual override exists', () => {
    for (const legacy of [false, true]) {
        const browser = createBrowser({ legacy })
        browser.ready()
        browser.system(true)
        assert.equal(browser.toggle.checked, true)
        browser.choose(false)
        browser.system(false)
        browser.system(true)
        assert.equal(browser.toggle.checked, false)
        assert.equal(browser.document.documentElement.dataset.theme, 'light')
    }
})

test('blocked storage still allows system detection and a manual choice for the current page', () => {
    const browser = createBrowser({ dark: true, blocked: true })
    browser.ready()
    assert.equal(browser.toggle.checked, true)
    browser.choose(false)
    browser.system(true)
    assert.equal(browser.document.documentElement.dataset.theme, 'light')
})

test('another tab can update or clear the saved preference', () => {
    const browser = createBrowser({ dark: true, stored: 'light' })
    browser.ready()
    const sendStorage = (key, newValue) => {
        const event = new Event('storage')
        Object.assign(event, { key, newValue, storageArea: browser.storage })
        browser.window.dispatchEvent(event)
    }
    sendStorage('unrelated', 'dark')
    assert.equal(browser.toggle.checked, false)
    sendStorage('ecadforge.theme', 'dark')
    assert.equal(browser.toggle.checked, true)
    sendStorage('ecadforge.theme', null)
    browser.system(false)
    assert.equal(browser.toggle.checked, false)
})
