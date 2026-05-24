# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Fresh scaffold. No domain code yet — purpose of the tool is still TBD. When real features land, expand this file with the bits a new instance can't infer from reading the code.

## Stack

TypeScript + React 19 + Vite 6. Vitest + Testing Library for tests. ESLint 9 flat config + typescript-eslint.

## Commands

| | |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b && vite build` — build **fails on type errors** because the build runs the project-references typecheck first |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Single-run Vitest (use this in CI / when you just want a pass/fail) |
| `npm run test:run -- src/App.test.tsx` | Run a single test file |
| `npm run test:run -- -t "renders heading"` | Run tests matching a name |
| `npm run lint` | ESLint over the whole project |
| `npm run typecheck` | `tsc -b --noEmit` — typecheck without building, respects project references |

## Architecture notes worth knowing up-front

- **TypeScript is split into project references** (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`). The root `tsconfig.json` only references them — don't add `compilerOptions` there. Editing options for app code goes in `tsconfig.app.json`.
- **Strict TS config**: `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noUncheckedSideEffectImports` are all on. Because of `verbatimModuleSyntax`, type-only imports must use `import type { Foo } from '...'` — a plain `import { Foo }` of a type-only symbol will fail to build.
- **Vitest config is split out into `vitest.config.ts`** (not the `test` block in `vite.config.ts`). The split exists because `vitest/config` ships its own bundled `vite` types — colocating them with the app's `vite` plugins causes a duplicate-types conflict at typecheck time. **Do not put `@vitejs/plugin-react` (or any other top-level Vite plugin) inside `vitest.config.ts`** for the same reason — Vitest already handles JSX/TS transforms internally. Test setup is `src/test/setup.ts` and registers `@testing-library/jest-dom/vitest` matchers. Tests run in `jsdom`. `globals: true` means `test` / `expect` are ambient — types for them come from the `vitest/globals` and `@testing-library/jest-dom` entries in `tsconfig.app.json#compilerOptions.types`. If you add another globals package, add it there too or editors will red-squiggle valid code.
- **ESLint is flat config** (`eslint.config.js`, ESM). React Hooks and React Refresh plugins are wired in; if you add new lint plugins, they go in the same `tseslint.config(...)` call.
- **React 19 + StrictMode** in `src/main.tsx` — effects will double-fire in dev, which is intentional. Don't "fix" that by removing StrictMode; fix the effect.

## Conventions

- Named exports for components (`export function App()` in `src/App.tsx`) rather than default exports — keeps refactors and grep'ing straightforward. Stick to this unless a library forces a default export.
- Co-locate tests next to source (`App.tsx` + `App.test.tsx`), not a parallel `__tests__` tree.
