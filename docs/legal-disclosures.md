# Public legal disclosures

The changes belong to `main`. They do not enable registration, billing, a paid
checkout or any code from `user-abo`. The current main application is the free,
account-free viewer. Publication is verified through the release deployment
workflow; a successful deployment does not send a confirmation email to Mollie.

## What Mollie requested

The email dated 26 October 2026 requests terms with the merchant's full name and
address, refund/return/cancellation rules, a privacy policy, and easily accessible
links in the footer and, where applicable, at checkout.

The public routes are `/impressum.html`, `/terms.html`, `/refunds.html` and
`/privacy.html`. Every public app/landing page links to all four. The app's former
“Privacy & security” resource link opens the privacy overlay. Each document is
available in German and English without JavaScript, sign-in or analytics and can
be saved/printed through the browser.

## Content and source of facts

`src/legal/seller.json` contains only the previously confirmed public merchant
profile. The correct street is **Rädelstraße 7**, replacing the older footer typo
“Rödelstraße”. No private tax number, ERP configuration or credentials are copied.
`src/legal/LegalDocuments.mjs` owns the authored prose. `npm run sync:legal`
generates the four HTML pages and `npm run check:legal` detects stale output.
The withdrawal form uses the same seller source as the contact blocks.

With JavaScript enabled, legal links on the app and landing pages open a native
modal containing the corresponding same-origin document. The current viewer URL
and loaded session remain in place. Close, backdrop click and Escape restore the
opener's focus and scroll state. Links between legal documents reuse the same
modal. The close mark is drawn with two centered strokes rather than a text glyph.
Direct URLs remain readable without JavaScript as a fallback.

German and English toggle buttons show one language at a time, update accessible
selection state and carry the chosen language through document cross-links.
Overlays initially follow the viewer language unless a document link explicitly
selects German or English. Without JavaScript both authored texts remain readable.
The original floating analytics popup is retained, with the same explicit consent
choices; opening its privacy link now keeps the viewer behind an overlay.

Terms describe the free viewer and, conditionally where offered, the established
Basic calendar-month offer: EUR 3 for the initial remainder month, then EUR 10 per
calendar month, with cancellation at the paid month's end. They do not turn that
offer on. Refund instructions distinguish statutory withdrawal, ordinary
subscription cancellation, failed/duplicate payments and the absence of physical
goods. No blanket loss of withdrawal on first use or acceptance of terms is claimed.

The privacy text covers hosting/contact, local parsing, explicit external source
and model requests, optional analytics and feedback, and account/payment processing
only where those optional features are enabled. It describes actual fingerprint
signals instead of calling cookieless tracking anonymous.

## Consent behavior and Analytics companion change

Detailed browser analytics is disabled until explicit permission. Accept and decline
have equal presentation. A persistent footer control and `/?privacy=analytics`
reopen the choice. Only `granted` authorizes the loader; storage failures leave
permission in memory for the current tab. Withdrawal and cross-tab revocation
stop the tracker, and pre-consent WebMCP activity is discarded, never replayed.
Local/private origins continue to skip the production tracker even after acceptance.

The companion change is on **Analytics `main`**, version 1.3.11. Its public tracker
adds `stop()` and `start()`, checks a consent-generation boundary after asynchronous
fingerprinting, discards prior interaction state and suppresses lifecycle events
while stopped. Existing hosts retain their current behavior until they use these
controls. ECAD Forge 1.13.51 also gives the accept button a green background and
the decline button an orange background, with white text and equal button sizing.

For publication, deploy the Analytics companion first and
verify the served tracker exposes `stop`/`start`, then publish the app. Do not
publish only the app against an older tracker: that older code cannot stop its
own automatic events on withdrawal. Verify both deployment workflows and the
served tracker before reporting a successful release.

## Review decisions that remain with the operator

The text is prepared for review, not a representation of legal approval. Review
prices, contract formation, liability wording and the public merchant profile.
Retention is expressed using purpose/legal-claim/statutory criteria because the
repositories do not establish approved numerical periods for every production
log, analytics record, mail provider and backup. Confirm those criteria against
the actual hosting/processing agreements, transfers and operational deletion
practice before publishing the policy; no fictitious retention timetable was added.

There is no checkout in `main`, so no checkout screen was changed. Before any
future online consumer sales, separately verify the public withdrawal function
under § 356a BGB and subscription termination function under § 312k BGB, durable
receipts and incorporation/versioning of the reviewed purchase texts. A mailto
link or this static withdrawal form is not presented as an implemented electronic
withdrawal/termination service. This task does not modify the parked billing work.

The confirmation reply to Mollie is saved in `docs/mollie-confirmation-draft.txt`.
It is labelled for use only after reviewed pages are actually published; it has
not been sent or entered into Gmail.

## Sources checked

- [Mollie: required website information](https://help.mollie.com/hc/en-gb/articles/211745545-What-information-needs-to-be-on-my-website)
- [§ 355 BGB: withdrawal](https://www.gesetze-im-internet.de/bgb/__355.html)
- [§ 356a BGB: online withdrawal function](https://www.gesetze-im-internet.de/bgb/__356a.html)
- [§ 312k BGB: online subscription termination](https://www.gesetze-im-internet.de/bgb/__312k.html)
- [GDPR, especially Articles 6, 13–22](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [DSK guidance on digital services and terminal-device consent](https://www.bfdi.bund.de/SharedDocs/Downloads/DE/DSK/Orientierungshilfen/OH_Digitale-Dienste.pdf?__blob=publicationFile&v=1)

## Validation

The app's full `npm test` suite passed (1,061 passed, one skipped), together
with `check:legal`, `check:structured-data` and `build:static`. Analytics' full
`npm test` passed (66 PHP and 78 JavaScript tests), as did PHP syntax checks.
Tests include fresh/denied/granted consent, restricted storage, revocation across
tabs, no pre-consent replay, blocked in-flight sends and clean regranting. Browser
checks exercised footer navigation, English anchors, consent controls and direct
legal routes. Chrome's captured warning/error log was empty. Firefox checked
1280px and 500px layouts without horizontal overflow (its requested 390px native
window was clamped to 500px). Screenshots are kept outside the source repository.

## Minimal server counts (1.13.52)

Production viewer document requests (`/`, `/index.html`, and viewer SPA routes) pass through `index.php`. GET deliveries send only `{"site_key":"ecadforge_app"}` from the web server to Analytics `/v1/aggregate`. The browser sends no analytics request before consent. No visitor headers, cookies, IP, URL/query, referrer, device attributes or identifiers are forwarded. HEAD, unsupported methods and local development do not count. Legal overlays and static assets do not increment viewer counts.

Analytics stores one atomic count per site/UTC day, retaining at most 400 days. It does not create sessions, detailed events or visitor hashes. The dashboard exposes `server_page_loads` separately: counts include reloads and bots, are not unique visitors, and must not be added to consented pageviews. Whole UTC days overlap the selected dashboard period. Delivery is best effort (500 ms maximum outbound timeout, no retry/replay); outages may undercount. The server response is finished before reporting where FastCGI supports it.

Pending, denied and granted consent all receive this same baseline. Granting starts detailed analytics from that point; withdrawal stops detailed tracking. Anonymous totals are never retroactively linked to a visitor. Hosting/security logs remain separate and are described in the privacy policy. The stated legitimate interest is minimal demand measurement and capacity planning; active device fingerprinting remains consent-only.

Design basis: [LfDI BW tracking FAQ, server-side counting example](https://www.baden-wuerttemberg.datenschutz.de/faq-zu-cookies-und-tracking-2/) and [DSK 2024 guidance on digital services](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/publikationen/DSK/2024/2024_DSK-OH_Digitale-Dienste.pdf). Cookieless tracking is not inherently exempt: this design avoids device access and does not forward visitor data. New dimensions, identifiers or client-side probes require a fresh assessment.

## Expanded server categories (1.13.53)

The basic counter above remains unchanged. Additional coarse HTTP/delivery statistics now use local reduction and separate daily marginals, thresholded and batched before transmission. The privacy text and all popup translations describe the independent server statistics and objection routes. [Exact categories and processing assessment](server-statistics.md). The optional device fingerprint tracker remains consent-only.
