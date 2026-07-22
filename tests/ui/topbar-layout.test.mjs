import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)

/**
 * Parses base-level CSS rules before responsive overrides.
 * @param {string} css Stylesheet text.
 * @returns {{ selectors: string[], declarations: Map<string, string> }[]}
 */
function parseBaseCssRules(css) {
    const baseCss = css.split('@media')[0]
    const rules = []
    const rulePattern = /([^{}]+)\{([^{}]+)\}/g

    for (const match of baseCss.matchAll(rulePattern)) {
        const selectors = match[1]
            .split(',')
            .map((selector) => selector.trim())
            .filter(Boolean)
        const declarations = new Map()

        for (const declaration of match[2].split(';')) {
            const separatorIndex = declaration.indexOf(':')

            if (separatorIndex === -1) continue

            declarations.set(
                declaration.slice(0, separatorIndex).trim(),
                declaration.slice(separatorIndex + 1).trim()
            )
        }

        rules.push({ selectors, declarations })
    }

    return rules
}

/**
 * Resolves a declaration for a simple class-based element context.
 * @param {string} css Stylesheet text.
 * @param {{ tagName: string, classes: string[], ancestorClasses: string[] }} context Element context.
 * @param {string} property CSS property name.
 * @returns {string}
 */
function resolveCssDeclaration(css, context, property) {
    let value = ''

    for (const rule of parseBaseCssRules(css)) {
        if (!rule.declarations.has(property)) continue

        if (
            rule.selectors.some((selector) =>
                selectorMatchesContext(selector, context)
            )
        ) {
            value = rule.declarations.get(property) || ''
        }
    }

    return value
}

/**
 * Checks whether a simple selector applies to the target context.
 * @param {string} selector CSS selector.
 * @param {{ tagName: string, classes: string[], ancestorClasses: string[] }} context Element context.
 * @returns {boolean}
 */
function selectorMatchesContext(selector, context) {
    const parts = selector
        .replace(/:[\w-]+(?:\([^)]*\))?/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)

    if (!parts.length) return false

    const target = parts.at(-1)
    const ancestors = parts.slice(0, -1)

    return (
        compoundMatchesContext(target, context.tagName, context.classes) &&
        ancestors.every((ancestor) =>
            compoundMatchesContext(ancestor, '', context.ancestorClasses)
        )
    )
}

/**
 * Checks whether one selector compound matches a tag and class list.
 * @param {string} compound Selector compound.
 * @param {string} tagName Target tag name.
 * @param {string[]} classes Target class names.
 * @returns {boolean}
 */
function compoundMatchesContext(compound, tagName, classes) {
    const tagMatch = compound.match(/^[a-z][\w-]*/i)
    const requiredClasses = [...compound.matchAll(/\.([\w-]+)/g)].map(
        (match) => match[1]
    )

    if (tagMatch && tagMatch[0].toLowerCase() !== tagName.toLowerCase()) {
        return false
    }

    return requiredClasses.every((className) => classes.includes(className))
}

/**
 * Verifies the landing toolbar controls keep a consistent control box.
 */
test('topbar file controls and language dropdown share control sizing', async () => {
    const css = await readFile(
        new URL('src/styles/10-layout.css', root),
        'utf8'
    )
    const fileControl = {
        tagName: 'label',
        classes: ['file-pill'],
        ancestorClasses: ['toolbar']
    }
    const localeControl = {
        tagName: 'label',
        classes: ['inline-field'],
        ancestorClasses: ['toolbar']
    }
    const localeSelect = {
        tagName: 'select',
        classes: [],
        ancestorClasses: ['toolbar', 'inline-field']
    }
    const toolbar = {
        tagName: 'div',
        classes: ['toolbar'],
        ancestorClasses: ['topbar']
    }

    assert.equal(resolveCssDeclaration(css, toolbar, 'grid-column'), '3')
    assert.equal(
        resolveCssDeclaration(css, fileControl, 'padding'),
        '0 0.95rem'
    )
    assert.equal(
        resolveCssDeclaration(css, localeControl, 'padding'),
        '0 0.95rem'
    )
    assert.equal(
        resolveCssDeclaration(css, fileControl, 'min-height'),
        '2.55rem'
    )
    assert.equal(
        resolveCssDeclaration(css, localeControl, 'min-height'),
        '2.55rem'
    )
    assert.equal(resolveCssDeclaration(css, localeSelect, 'height'), '')
    assert.equal(resolveCssDeclaration(css, localeSelect, 'outline'), 'none')
})
