# Multi-File Viewer Sidebar Design

**Goal:** Allow the viewer to keep multiple parsed documents open at once, show a left-side preview rail only when more than one document is loaded, and switch the large viewer panel to the clicked file while keeping the existing top tabs global.

**Context:** The current viewer session is single-document only. Every successful parse replaces the prior document, which makes it impossible to compare several schematic or PCB files within the same browser session. The requested interaction is a file-only sidebar similar to a sheet navigator: one tile per open file on the left, large viewer on the right, and no sidebar when only one file is open.

## Options Considered

1. **Recommended: promote the app to session-based multi-document state**
   Store all successfully parsed documents in `AppState`, track one `activeDocumentId`, and keep `activeView` global across the session.

2. **Keep multi-document state inside `AppController` only**
   Let the controller keep an internal list of documents while the public state continues to expose only one active document.

3. **Treat the sidebar as view-local cache**
   Keep cached previews and parsed models inside `AppView` and swap the main panel without expanding the central state model.

## Chosen Design

Use option 1.

The viewer already derives tabs, active file labels, diagnostics counts, and summary cards from application state. Extending that state into a session-level document collection keeps one source of truth for both the sidebar and the large viewer. It also avoids splitting behavior across controller internals and view-local caches.

## Architecture

The app will move from a single `documentModel` state shape to a multi-document session shape. Session state will keep:

- `documents[]`: successful parsed document entries with a stable in-session id
- `activeDocumentId`: the currently selected file in the sidebar and main panel
- `activeView`: one global tab selection shared by all files
- `parseStatus`, `statusMessage`, and `locale`

The active document model and active file name remain derived values from `documents[]` and `activeDocumentId` so most rendering logic can keep operating against a single current document.

`AppController` will append each successful parse result to the session, assign it an id, and make the newest successful document active. Failed parses and invalid files must not clear already-open documents.

## UI Behavior And Data Flow

The left preview rail appears only when more than one document is loaded. Each card represents one loaded file. Clicking a card changes only `activeDocumentId`; it does not change the current top tab.

The preview tiles follow the current global tab:

- `schematic`: miniature schematic preview where available
- `pcb`: miniature PCB preview where available
- `3d`: compact 3D summary preview
- `bom`: compact BOM summary preview
- `diagnostics`: compact diagnostics summary preview

If a given document cannot render the currently selected tab, the tile shows a compact fallback state instead of disappearing or breaking layout.

The large viewer on the right continues to use the existing renderer family, but now it renders the currently active session document.

## Error Handling

- Multiple file selection and repeated opens are allowed.
- Invalid files still produce an error status.
- Parse failures preserve the existing session and active selection.
- Only successful parses add a new sidebar card.
- When only one document is open, the sidebar is hidden completely.

## Testing

The change should be locked down at three layers:

- `AppState` tests for session document storage, active-document switching, and derived active document values
- `AppController` tests for multi-file loading, active-file switching, and parse-error preservation of existing documents
- `AppView` tests for conditional sidebar visibility, active-card state, sidebar click binding, and compact preview/fallback rendering
