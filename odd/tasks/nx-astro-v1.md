# nx-astro v1

Objective: first release of `@code-lovers/nx-astro`, an Nx 24 plugin for Astro 7, per `docs/design.md`.
Branch: `main` for the scaffold, then `feat/plugin-v1`. Delivery: local only, no push or publish without explicit approval. Test runner: vitest.

## Specs

- S1. The design in `docs/design.md` is the specification. Every task implements its section of the design.
- S2. Quality checklist: "si vamos a usar nuestro checklist de calidad que esta en obsidian, lo peudes buscar con mas de 40+ puntos que verificar". Source: `Open Source/00 Playbook/Playbook - Checklist de reglas.md` (44 rules) in the Obsidian vault. Rules 1 to 14 apply while writing. Rules 15 to 44 are audits before review. This is Johnny's own project, so rules 6, 9, 10 and 12 apply in full.
- S3. The five focus points: "código declarativo y nunca imperativo, baja complejidad ciclomática, baja entropía, buena DX, mantenibilidad".
- S4. Package name `@code-lovers/nx-astro`. Astro 7 only.
- S5. Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Author `Johnny Huirilef <johnnyhuirilef@gmail.com>`. Check `%ae` before any push.
- S6. Test-first: observe RED before each rule is implemented, then GREEN. Mutation check on new lines (rule 31).

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T1 | S1, S4, S5 | Plugin workspace with `@nx/plugin`, vitest and e2e setup | inline | done | `e4fa051` on `main`. lint, build, typecheck exit 0. e2e 1/1 passed. `nx-astro:test` fails with "No test files found" until T2 adds the first spec |
| T2 | S1-S3, S6 | `config/`: static parse of `astro.config.*` | inline | done | RED 8/10 against a stub, GREEN 12/12. 16 mutants killed (M11 survived first, fixed with a literal defaults test). test, typecheck, lint, build exit 0 |
| T3 | S1-S3, S6 | `targets/` and `createNodes` (no cache, see L5) | inline | done | RED 10/10 (targets) and 9/11 (plugin) on stubs, GREEN 35/35. 24 mutants killed (3 survived first, fixed with 3 tests). test, typecheck, lint, build exit 0. Smoke: real nx 24.0.5 loads `dist/plugins/plugin.js` and infers build, dev, preview, sync |
| T4 | S1-S3, S6 | `graph/`: import specifiers from `.astro` files | inline | done | RED 7/9 on stubs, GREEN 51/51 (whole package). 17 mutants killed (5 survived across two rounds, fixed with tests or by removing a redundant check). test, typecheck, lint, build exit 0 |
| T5 | S1-S3, S6 | `graph/`: map specifiers to projects, `createDependencies` | inline | pending | |
| T6 | S1-S3, S6 | `init` and `application` generators | inline | pending | |
| T7 | S1, S6 | e2e: cache hit and graph edge | inline | pending | |
| T8 | S1 | Try it on one Astro project, README | inline | pending | |

Route evidence: no Writer trigger. The tasks depend on each other in sequence, so no parallel units.

## Log

- L1 (2026-11-09): "si vamos a usar nuestro checklist de calidad que esta en obsidian, lo peudes buscar con mas de 40+ puntos que verificar" (answer to "¿Arranco con T1?").
- L2: Decisions taken before L1: package `@code-lovers/nx-astro`, Astro 7 only. See `docs/design.md`, section Decisions.
- L3 (2026-11-09): T1. `create-nx-plugin@24.0.5` ignored `--interactive=false` and blocked on the `createPackageName` prompt, so the workspace came from `create-nx-workspace --preset=ts` plus `@nx/plugin:plugin`. Template fixes: vitest `environment` from `jsdom` to `node`, e2e `pnpm add` with `--allow-build=nx --allow-build=@swc/core` (pnpm 12 fails on ignored builds), `create-nx-workspace` pinned to the nx version, custom condition `@org/source` renamed to `@code-lovers/source`. Known noise: the verdaccio executor logs "Failed to start verdaccio: undefined" at teardown while the e2e passes. The template also committed AI agent folders (`.agents`, `.claude`, `.codex`, `.cursor`, `.gemini`, `.opencode`, `.github/skills`).
- L4 (2026-11-09): T2. Parser: `magicast` 0.5 (`parseModule` + `getDefaultExportOptions`), the library `astro add` uses on the same file. It is a direct dependency, not borrowed from `astro`, because the config parser does not need to match the Astro version. magicast is ESM only and the plugin is CommonJS. `require()` of the built file works on Node 26 (require(esm), available since Node 22.12, below the Astro 7 floor of 22.23.4). magicast throws when it reads a non-literal value such as a template literal, so each key is read on its own and reported in `nonLiteralKeys`. `radashi` `mapValues` builds the typed result without `as` (rules 4 and 12). Known limitation, pinned by a test: a default export that is a variable (`export default config`) gives the defaults. Checklist audit: rule 30 is open until T3 uses `ASTRO_CONFIG_FILE_NAMES` and `readAstroConfig`. Rule 39: the magicast comment was checked in a probe ("Casting TemplateLiteral is not supported").
- L5 (2026-11-09): T3. Decision 3 in the design: no target cache. `PluginCache` and `calculateHashesForCreateNodes` exist only in `@nx/devkit/internal`, and the static parse takes 0.12 ms per config (5 ms cold). `srcDir` and `publicDir` were dropped from the config reader (commit `5d3a08d`), because no target uses them (rule 23). Entry point: `@code-lovers/nx-astro/plugin`. `astro` is a peer (`^7.0.0`) that no file imports, so it is in `ignoredDependencies` of `@nx/dependency-checks`. Fallback messages use `logger.verbose`, so a computed `outDir` does not print on every graph run (rule 28 decision). Checklist: rule 30 closed, rule 16 (the glob comes from `ASTRO_CONFIG_FILE_NAMES`), rule 21 (`resolvesAstroCheck` returns false as its signal), rule 4 (no `as` casts).
- L6 (2026-11-09): T4. `@astrojs/compiler-rs` 0.5.2 is ESM only and loads through `require()`. It never throws: it returns `diagnostics` and a partial AST, so frontmatter imports survive a broken template. Type-level `import('x').T` is a `TSImportType` with a literal `source`, so the node-type filter is needed. CSS `@import` is not parsed as JS, so it gives no edge. `astro` 7.4.7 is now a root devDependency for tests and the e2e.
- L7 (2026-11-09), user: "ojo con esto?? [the bare try/catch in loadAstroParser] ver si podeos mejorarlo". Result: `loadAstroParser` returns `AstroParserLoad` with `loaded`, `astro-not-found` or `compiler-unavailable` plus the reason, so T5 can log each case at its own level (rules 21 and 28).
- L8 (2026-11-09), user: "ojo con astro, porque tiene su propio sistema de preguntar si usar react, svelte entre otras preguntas y eso deberia soportarlo el plugins no???". Proposal for T6, pending the user's decision: an `integrations` option on the `application` generator with an `x-prompt` multiselect, which runs `astro add <names> --yes` after the files are written, plus an `integration` generator for existing projects. Verified: `astro add --help` in 7.4.7 lists `--yes` and the integrations (react, preact, vue, svelte, solid-js, lit, alpinejs, starlight, netlify, vercel, deno, cloudflare, node, tailwind, mdx, markdoc, partytown, sitemap).
