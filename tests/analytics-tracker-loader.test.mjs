import assert from 'node:assert/strict'
import test from 'node:test'
import { AnalyticsTrackerLoader } from '../src/AnalyticsTrackerLoader.mjs'

/**
 * Minimal fake document head for tracker loader assertions.
 */
class FakeHead {
    constructor() {
        this.children = []
    }

    /**
     * Records one appended script node.
     * @param {object} node Node to append.
     * @returns {object}
     */
    appendChild(node) {
        this.children.push(node)
        return node
    }
}

/**
 * Minimal fake document for tracker loader assertions.
 */
class FakeDocument {
    constructor() {
        this.head = new FakeHead()
    }

    /**
     * Creates a fake element with script-like fields.
     * @param {string} tagName Tag name.
     * @returns {object}
     */
    createElement(tagName) {
        return {
            async: true,
            dataset: {},
            defer: false,
            src: '',
            tagName: String(tagName || '').toUpperCase()
        }
    }

    /**
     * Finds the ECAD Forge analytics tracker script.
     * @param {string} selector CSS selector.
     * @returns {object | null}
     */
    querySelector(selector) {
        if (selector !== 'script[data-analytics-tracker="ecadforge"]') {
            return null
        }

        return (
            this.head.children.find(
                (child) => child.dataset.analyticsTracker === 'ecadforge'
            ) || null
        )
    }
}

test('AnalyticsTrackerLoader skips local browser origins', () => {
    const localOrigins = [
        'http://localhost:3000/',
        'http://127.0.0.1:3000/',
        'http://[::1]:3000/',
        'file:///Users/example/ecadforge/index.html'
    ]

    for (const origin of localOrigins) {
        assert.equal(
            AnalyticsTrackerLoader.shouldLoadForLocation(origin),
            false
        )
    }
})

test('AnalyticsTrackerLoader appends production tracker for deployed origins', () => {
    const documentObject = new FakeDocument()

    const didLoad = AnalyticsTrackerLoader.loadBrowserTracker(
        documentObject,
        'https://ecadforge.app/?view=bom'
    )

    assert.equal(didLoad, true)
    assert.equal(documentObject.head.children.length, 1)
    assert.deepEqual(documentObject.head.children[0], {
        async: false,
        dataset: {
            analyticsTracker: 'ecadforge',
            site: 'ecadforge_app'
        },
        defer: true,
        src: 'https://analytics.andrefiedler.de/tracker.js',
        tagName: 'SCRIPT'
    })
})

test('AnalyticsTrackerLoader does not append duplicate tracker scripts', () => {
    const documentObject = new FakeDocument()

    AnalyticsTrackerLoader.loadBrowserTracker(
        documentObject,
        'https://ecadforge.app/'
    )
    const didLoadAgain = AnalyticsTrackerLoader.loadBrowserTracker(
        documentObject,
        'https://ecadforge.app/'
    )

    assert.equal(didLoadAgain, false)
    assert.equal(documentObject.head.children.length, 1)
})
