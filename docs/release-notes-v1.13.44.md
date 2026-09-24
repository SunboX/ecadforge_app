# ECAD Forge 1.13.44

Version 1.13.44 adds a prominent support entry point and makes public bug and
feature reporting discoverable to AI agents, including when WebMCP is unavailable.

## Support for people and agents

- Add a persistent **Request support** button to the header in landing and
  loaded-viewer modes. It opens the GitHub issue tracker in a separate tab,
  preserves the open design, supports keyboard focus, and fits both themes and
  narrow screens.
- Translate the button and its new-tab announcement into all seven supported
  languages: English, German, Spanish, French, Brazilian Portuguese,
  Vietnamese, and Simplified Chinese.
- Publish HTML help links and `/llms.txt` so bots can discover the reporting
  workflow without JavaScript or a working WebMCP connection.
- Register the read-only `prepare_issue_report` WebMCP tool. It prepares a
  bounded public title, description, app version, and prefilled GitHub URL
  without requiring a loaded design. Long encoded reports retain their full
  text for submission through a GitHub client or manual paste.
- Keep submission explicit through an authenticated GitHub integration or
  GitHub's issue form. The tool returns `submitted: false`, attaches no private
  design or session data, and excludes report text from automatic telemetry.
  The existing `submit_agent_feedback` Analytics channel remains separate.
- Update the README, WebMCP documentation, security documentation, and app
  specification to explain discovery, privacy, and submission behavior.

## Release details

- App version: **1.13.43 → 1.13.44**, including synchronized structured data.
- Toolkit versions remain current and unchanged: Altium Toolkit **1.4.18**,
  CircuitJSON Toolkit **1.4.3**, Gerber Toolkit **0.4.4**, KiCad Toolkit
  **1.3.6**, and PCB Scene3D Viewer **1.3.4**.
- No development branches required merging.

## Validation

- All **1,033 tests passed**, including support-tool validation, cancellation,
  Unicode and long-URL handling, registration, and server/deployment guide checks.
- Structured-data freshness, static deployment build, and diff checks passed.
- Browser checks covered seven languages at widths from 320 to 1440 pixels,
  both themes, keyboard focus, no-JavaScript support, and a loaded viewer.
- The browser's packaged WebMCP runtime discovered and executed the support
  tool; the support link opened the correct GitHub tracker in a separate tab.
  No test issue was submitted.

## Screenshots

- [Desktop viewer](https://github.com/SunboX/ecadforge_app/releases/download/v1.13.44/ecadforge-support-desktop.png)
- [Mobile view](https://github.com/SunboX/ecadforge_app/releases/download/v1.13.44/ecadforge-support-mobile.png)
