# ECAD Forge 1.13.51

This release includes the legal-disclosure and consent work developed locally
since the published 1.13.48 release.

- Adds German/English merchant details, terms, withdrawal/refund/cancellation
  information and a privacy policy, linked from the app and landing pages.
- Opens legal documents in overlays that retain the current viewer URL, with
  language toggles, keyboard dismissal, restored focus and a centered close icon.
- Requests consent before automatic analytics. The original floating popup is
  retained: **Allow analytics** is green and **Decline analytics** is orange.
  Both choices have equal sizing and readable white text.
- Stops analytics on withdrawal and discards pre-consent activity. This depends
  on the Analytics 1.3.11 tracker companion, which must be deployed first.

The Analytics deployment now fetches and verifies its triggering commit directly
from its own Git server, avoiding an external checkout-action download.

The account/billing feature branches, including `user-abo`, are excluded. Toolkit
dependencies are unchanged. No additional feature branch is merged by this release.

Validation: 1,061 app tests passed, one skipped; legal-page freshness,
structured-data checks and static build passed. Analytics 1.3.11 passed 66 PHP
and 78 JavaScript tests plus PHP syntax checks. The consent colors were checked
in the rendered local app before deployment.
