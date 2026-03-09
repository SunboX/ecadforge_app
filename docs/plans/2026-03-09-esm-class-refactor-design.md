# ESM Class API Refactor Design

**Date:** 2026-03-09

## Goal

Refactor the reusable `.mjs` modules in the Altium Viewer codebase toward consistent modern ESM class-based APIs, reducing broad standalone function exports while preserving current runtime behavior.

## Scope

### In Scope

- Review every `.mjs` file in `src/` and `tests/`
- Convert reusable source modules that currently export standalone functions into single exported classes
- Prefer static class methods for pure parser and renderer helpers
- Keep runtime entrypoint scripts as non-exporting modules
- Update imports, workers, and tests to the new class APIs
- Keep behavior stable and verified with the existing test suite

### Out Of Scope

- Changing the user-facing viewer behavior intentionally
- Rewriting already class-based modules without clear need
- Introducing framework, build, or runtime architecture changes
- Converting entry modules such as `main.mjs`, `server.mjs`, or worker bootstrap scripts into exported classes

## Current State

The codebase already uses classes effectively at the application boundary:

- `AppController`
- `AppView`
- `AppState`
- `I18nService`
- `AsciiRecordParser`
- `PrintableTextDecoder`

The inconsistency is concentrated in reusable parser and renderer modules that expose many standalone exports:

- `ParserUtils.mjs`
- `SchematicTextParser.mjs`
- `SchematicPinParser.mjs`
- `SchematicAnnotationParser.mjs`
- `AltiumParser.mjs`
- `SchematicSvgUtils.mjs`
- `SchematicSvgRenderer.mjs`
- `BomTableRenderer.mjs`
- `PcbSvgRenderer.mjs`
- `Scene3dRenderer.mjs`

## Approaches Considered

### Approach 1: Only Wrap Utility Modules

Convert the multi-export helper files to classes but leave renderer and parser entry modules as standalone exported functions.

**Pros**

- Lowest code churn
- Smallest import update surface

**Cons**

- Leaves the public API inconsistent
- Does not fully satisfy the preference for class-based ESM modules

### Approach 2: One Exported Class Per Reusable Module

Convert every reusable source module with exported functions into one exported class, usually using static methods, while keeping runtime entrypoints as scripts.

**Pros**

- Consistent source API style
- Low conceptual overhead because most modules remain stateless
- Clear fit for existing file naming rules

**Cons**

- Moderate import and test churn
- Requires careful treatment of private helpers and JSDoc coverage

### Approach 3: Deep Multi-Class Decomposition

Convert the function modules to classes and also split large files like `SchematicSvgRenderer.mjs` and `AltiumParser.mjs` into several collaborating classes.

**Pros**

- Potentially cleaner long-term separation
- Smaller files and more localized responsibilities

**Cons**

- Highest churn and regression risk
- Larger surface area than needed for a behavior-preserving refactor

## Selected Design

Use **Approach 2**.

Reusable source modules will expose one primary class each. The classes will use static methods where the behavior is effectively pure and does not benefit from instance state. Runtime entrypoints remain side-effect scripts because they represent application bootstrapping rather than reusable APIs.

## Module Design

### Keep As-Is

These files already match the intended style closely enough:

- `src/AppController.mjs`
- `src/I18n.mjs`
- `src/core/AppState.mjs`
- `src/core/altium/AsciiRecordParser.mjs`
- `src/core/altium/PrintableTextDecoder.mjs`
- `src/main.mjs`
- `src/server.mjs`
- `src/workers/altium-parser.worker.mjs`
- `src/workers/counter.worker.mjs`

### Convert To Class APIs

- `src/core/altium/ParserUtils.mjs` -> `export class ParserUtils`
- `src/core/altium/SchematicTextParser.mjs` -> `export class SchematicTextParser`
- `src/core/altium/SchematicPinParser.mjs` -> `export class SchematicPinParser`
- `src/core/altium/SchematicAnnotationParser.mjs` -> `export class SchematicAnnotationParser`
- `src/core/altium/AltiumParser.mjs` -> `export class AltiumParser`
- `src/ui/SchematicSvgUtils.mjs` -> `export class SchematicSvgUtils`
- `src/ui/SchematicSvgRenderer.mjs` -> `export class SchematicSvgRenderer`
- `src/ui/BomTableRenderer.mjs` -> `export class BomTableRenderer`
- `src/ui/PcbSvgRenderer.mjs` -> `export class PcbSvgRenderer`
- `src/ui/Scene3dRenderer.mjs` -> `export class Scene3dRenderer`

## Internal Structure Rules

- Public reusable behavior should be exposed through class methods rather than many named function exports
- Non-public helpers should become ECMAScript private static methods where reasonable
- Every public and private method should keep JSDoc coverage
- Large renderers may use private static helper methods instead of free functions
- Shared markup helpers should be centralized to reduce duplicate escaping and numeric formatting code

## Data And Control Flow

1. Entry scripts and already class-based controllers continue to orchestrate the app
2. Workers, controllers, and views import class modules instead of individual functions
3. Parsing flows through class methods like `AltiumParser.parseArrayBuffer()`
4. Rendering flows through class methods like `SchematicSvgRenderer.render()`
5. Tests validate behavior through the new public class entrypoints

## Error Handling

- Preserve existing thrown errors and fallback behavior
- Do not change the parser’s unsupported-file handling
- Keep renderer empty-state markup unchanged
- Avoid mixing refactor changes with behavior changes unless tests expose a bug

## Testing Strategy

- Update parser tests to call class entrypoints
- Update renderer tests to call class render methods
- Keep observable assertions the same wherever possible
- Run the full `npm test` suite after refactor completion

## Risks

- Private helper conversion can accidentally change call ordering or fallback behavior
- Shared utility centralization can subtly affect string escaping or numeric formatting
- Large-file refactors can create import or method binding mistakes if done mechanically

## Mitigations

- Convert API surface incrementally by subsystem
- Preserve method bodies as closely as possible during the first pass
- Keep tests focused on observable output rather than internal structure
- Verify after each module group and again with the full test suite
