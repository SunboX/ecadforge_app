# AGENTS

## Project Overview

- Repository: `Altium Viewer` web application.
- Browser app source is in `src/`.
- Tests are in `tests/`.
- Specifications are in `spec/`.
- Documentation is in `docs/`.

## Build, Run, Test

- Install: `npm install`
- Run: `npm start`
- Open: `http://localhost:3000/`
- Test: `npm test`

## Coding Style & Naming Conventions

- Prettier settings are in `.prettierrc.json`: 4-space indent, single quotes, no semicolons, no trailing commas.
- Keep files under 1000 lines; split modules/classes when they grow.
- Keep each CSS file under 1000 lines; use `src/styles/` and keep `src/style.css` as entrypoint.
- Add JSDoc for every function/method, including private helpers.
- Add inline comments where non-obvious behavior needs context.
- Utility modules should use class-based organization with static methods when appropriate.
- For single-class modules, name the `.mjs` file in CamelCase to match the class name.
- For private internals, use ECMAScript private elements (`#privateField`, `#privateMethod`).
- Use getters/setters for controlled mutable state.
- Prefer `async/await` for naturally asynchronous operations.
- Use `main.mjs` as the browser entry module and keep the HTML script tag in sync.

## Testing Guidelines

- Use repo scripts only (`npm test`).
- After each code change, run `npm test` or do a UI sanity check.
- For every feature/fix/behavior change, add or update tests in `tests/`.
- Keep tests focused on observable app behavior.

## Commit & Pull Request Guidelines

- Commit messages start with a prefix like `fix:`, `feature:`, `chore:` plus a short imperative summary.
- With every change, increment the app version in `package.json`.
- Keep merge request summaries concise and include test results.
- Attach screenshots for visual changes.

## Documentation Guidelines

- Keep root `README.md` as the entry point.
- Keep detailed docs in `docs/` and update them with behavior/architecture changes.
- Keep acceptance criteria and scope in `spec/`.

## Security & Configuration Tips

- Keep secrets out of Git; `.env` is gitignored.
- Validate user-provided input on both UI and server boundaries.
- Prefer local-first defaults; document any outbound network behavior explicitly.
