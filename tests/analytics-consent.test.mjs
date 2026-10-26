import assert from 'node:assert/strict'
import test from 'node:test'
import { AnalyticsConsent } from '../src/AnalyticsConsent.mjs'
import { PrivacySafeAnalytics } from '../src/PrivacySafeAnalytics.mjs'

/** A small event-driven browser fake for visible consent controls and storage failures. */
class ConsentBrowser {
    nodes = new Map()
    listeners = new Map()
    values = new Map()
    grants = 0
    stops = 0
    storage = {
        getItem: (key) => this.values.get(key) || null,
        setItem: (key, value) => this.values.set(key, value)
    }

    /** Construct controls with the same event boundary as the rendered page. */
    constructor(choice, restricted = false) {
        if (choice) this.values.set(AnalyticsConsent.STORAGE_KEY, choice)
        for (const key of ['consent', 'accept', 'decline', 'settings']) {
            this.nodes.set(`[data-analytics-${key}]`, {
                hidden: true,
                listeners: new Map(),
                /** Capture a DOM listener for an explicit user event. */
                addEventListener(name, listener) {
                    this.listeners.set(name, listener)
                },
                /** Record focus restoration without a layout dependency. */
                focus() {
                    this.focused = true
                }
            })
        }
        this.window = {
            location: { href: 'https://viewer.example.test/' },
            localStorage: restricted
                ? {
                      getItem() {
                          throw new Error('Restricted')
                      },
                      setItem() {
                          throw new Error('Restricted')
                      }
                  }
                : this.storage,
            AnalyticsTracker: { stop: () => this.stops++ },
            addEventListener: (name, listener) =>
                this.listeners.set(name, listener)
        }
        this.consent = new AnalyticsConsent({
            documentObject: {
                querySelector: (selector) => this.nodes.get(selector)
            },
            windowObject: this.window,
            onGrant: () => this.grants++
        })
    }

    /** Simulate a user activating the actual bound control. */
    click(action) {
        this.nodes.get(`[data-analytics-${action}]`).listeners.get('click')()
    }
}

test('unknown consent does not load analytics and declining preserves the decision', () => {
    const browser = new ConsentBrowser()
    browser.consent.initialize()
    assert.equal(browser.grants, 0)
    assert.equal(browser.nodes.get('[data-analytics-consent]').hidden, false)
    browser.click('decline')
    assert.equal(browser.consent.granted, false)
    assert.equal(browser.values.get(AnalyticsConsent.STORAGE_KEY), 'denied')
    assert.equal(browser.nodes.get('[data-analytics-consent]').hidden, true)
    const nextVisit = new ConsentBrowser('denied')
    nextVisit.consent.initialize()
    assert.equal(nextVisit.grants, 0)
    assert.equal(nextVisit.nodes.get('[data-analytics-consent]').hidden, true)
})

test('grant, reopen, withdraw and grant again each update the current tab', () => {
    const browser = new ConsentBrowser()
    browser.consent.initialize()
    browser.click('accept')
    assert.equal(browser.grants, 1)
    assert.equal(browser.consent.granted, true)
    browser.click('settings')
    assert.equal(browser.nodes.get('[data-analytics-consent]').hidden, false)
    browser.click('decline')
    assert.equal(browser.consent.granted, false)
    assert.equal(browser.stops, 1)
    browser.click('settings')
    browser.click('accept')
    assert.equal(browser.grants, 2)
})

test('stored grants and cross-tab withdrawals apply without collecting before permission', () => {
    const browser = new ConsentBrowser('granted')
    browser.consent.initialize()
    assert.equal(browser.grants, 1)
    browser.listeners.get('storage')({
        key: AnalyticsConsent.STORAGE_KEY,
        newValue: 'denied',
        storageArea: browser.storage
    })
    assert.equal(browser.consent.granted, false)
    assert.equal(browser.stops, 1)
    browser.listeners.get('storage')({
        key: 'unrelated',
        newValue: 'granted',
        storageArea: browser.storage
    })
    assert.equal(browser.consent.granted, false)
})

test('restricted storage uses a tab-only choice and privacy deep links reopen settings', () => {
    const browser = new ConsentBrowser(null, true)
    browser.consent.initialize()
    assert.equal(browser.grants, 0)
    browser.click('accept')
    assert.equal(browser.consent.granted, true)
    browser.click('decline')
    assert.equal(browser.consent.granted, false)
    const stored = new ConsentBrowser('denied')
    stored.window.location.href += '?privacy=analytics'
    stored.consent.initialize()
    assert.equal(stored.nodes.get('[data-analytics-consent]').hidden, false)
})

test('activity before consent is discarded and never replayed after acceptance', () => {
    const events = []
    let allowed = false
    const analytics = new PrivacySafeAnalytics({
        isEnabled: () => allowed,
        tracker: {
            trackEvent: (...event) => events.push(event),
            setContext: () => events.push('context')
        }
    })
    analytics.track('webmcp_tool_call', { methodName: 'get_project' })
    analytics.setContext({ activeView: 'pcb' })
    assert.deepEqual(events, [])
    allowed = true
    analytics.syncContext()
    assert.deepEqual(events, ['context'])
    allowed = false
    assert.equal(analytics.syncContext(), false)
})
