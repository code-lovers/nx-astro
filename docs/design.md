# @code-lovers/nx-astro: design

Status: draft for review, 2026-11-08. No code exists yet.

An Nx plugin for Astro that works the way the Nx 24 first-party plugins work. Nx infers the tasks from `astro.config.*`, and the project graph includes the imports in `.astro` files.

## Goals

1. A user adds the plugin to `nx.json` and gets cached `build`, `dev`, `preview`, `sync`, and `check` tasks with no `project.json` targets.
2. `nx graph` shows an edge when a `.astro` file imports a file or package from another project in the workspace.
3. Each new major version of Astro or Nx gets a migration.
4. The plugin uses only public APIs of Nx and Astro, or isolates the private ones behind one module with a test.

## Non-goals for the first release

- Executors. The tasks run the `astro` CLI directly.
- A `library` generator. It comes after `application`, when a real project needs it.
- Edges from `.md`, `.mdx`, `.mdoc` and content collection files.
- Support for Astro older than 7 or Nx older than 24.

## Support matrix

| Dependency | Range | Reason |
|---|---|---|
| `nx`, `@nx/devkit` | `^24.0.0` | `CreateNodes`, `PluginCache`, `calculateHashesForCreateNodes`, `continuous` tasks |
| `astro` | `^7.0.0` | Rust compiler, Vite 8, current config defaults |
| Node.js | `>=22.23.4` | The `engines.node` of Astro 7 |

## Architecture

The package has three parts. Each part has its own tests.

```
src/
  plugins/
    plugin.ts            createNodes + createDependencies (public entry point)
    config/              reads astro.config.* without running it
    targets/             builds the inferred targets from the config facts
    graph/               finds imports in .astro files and maps them to projects
  generators/
    init/                registers the plugin in nx.json, adds astro to devDependencies
    application/         creates an Astro app
  migrations/
```

### 1. Config facts (`config/`)

The plugin needs `outDir`, `srcDir` and `publicDir` for the task inputs and outputs. Astro has no public API that returns the resolved config.

Decision: parse the config file statically and read literal values only.

- The plugin looks for `astro.config.mjs`, `.js`, `.ts` and `.mts`, in the same order as Astro. Astro 6 dropped `.cjs` and `.cts`.
- The parser reads the object that the file passes to `defineConfig` or exports as default. It reads `outDir`, `srcDir`, `publicDir` and `root` only when each value is a string literal.
- If a value is not a literal, the plugin uses the Astro default (`./dist`, `./src`, `./public`) and logs a debug message.
- A plugin option overrides each value: `outDir`, `srcDir`, `publicDir`.

| Option | For | Against |
|---|---|---|
| Static parse + overrides (chosen) | Fast, does not run user code, uses public parsers only | Misses computed values and integrations that change `outDir` |
| Private `resolveConfig` from `astro/dist/core/config` | Exact values for literal and computed config | Not in the exports map, so any Astro release can break it. 200–330 ms per project for `.ts` configs. Still misses integration `updateConfig` |
| Hard-coded `dist` | Simplest | Wrong for any project that sets `outDir` |

### 2. Inferred targets (`targets/`)

The names are configurable through plugin options (`buildTargetName` and the others), like `@nx/vite`.

| Target | Command | Cache | Inputs | Outputs | Other |
|---|---|---|---|---|---|
| `build` | `astro build` | yes | `production`, `^production`, `externalDependencies: ['astro']` | `{projectRoot}/<outDir>`, `{projectRoot}/.astro` | `dependsOn: ['^build']` |
| `sync` | `astro sync` | yes | `production`, `externalDependencies: ['astro']` | `{projectRoot}/.astro` | Writes generated types to `.astro/`. Astro hard-codes this path |
| `check` | `astro check` | yes | `default`, `^production`, `externalDependencies: ['astro', '@astrojs/check', 'typescript']` | none | Inferred only when `@astrojs/check` is installed |
| `dev` | `astro dev` | no | — | — | `continuous: true` |
| `preview` | `astro preview` | no | — | — | `continuous: true`, `dependsOn: ['build']` |

Each command runs with `cwd: {projectRoot}`. Nx runs its own `astro-docs` project the same way, because package scripts failed on the `node_modules` lookup.

The plugin infers `check` only when `@astrojs/check` resolves from the project. Without it, `astro check` shows an interactive install prompt, and that prompt blocks CI.

The plugin caches the targets with `PluginCache`, keyed by `calculateHashesForCreateNodes`, the same way as `packages/vite/src/plugins/plugin.ts` in Nx.

### 3. Graph edges (`graph/`)

`createDependencies` receives the changed files. For each `.astro` file in a project that has an Astro config, it does two steps.

Step 1, find the import specifiers. Decision: use `@astrojs/compiler-rs`, resolved from the installed `astro` package.

- Astro 7 compiles `.astro` files with this parser, so the plugin reads exactly the syntax that Astro accepts.
- `parse()` is synchronous and returns an ESTree AST. The frontmatter is `AstroRoot.frontmatter.program`. The plugin reads `ImportDeclaration`, `ImportExpression` and `export ... from`, and skips type-only imports.
- Measured: 3.6 ms for the first file, 0.02 ms for each file after it.
- The plugin resolves the parser through `createRequire` from the location of `astro`. Then the parser version always matches the Astro version of the workspace, and the plugin does not add a second native binary.

| Option | For | Against |
|---|---|---|
| `@astrojs/compiler-rs` through `astro` (chosen) | Same parser as Astro, fast, already installed | Pre-1.0. The AST shape can change in a minor release |
| `findImports` from `nx/src/native` | Already handles `.astro`, no extra dependency | Internal to Nx. It also reports CSS `@import`, which creates wrong edges |
| `@astrojs/compiler` (Go/WASM) | Stable API | Astro 7 does not use it anymore, so the syntax can differ |

Step 2, map each specifier to a project.

- A relative specifier becomes a workspace file path. The plugin finds the project whose root contains that path.
- A bare specifier is compared with the package names of the workspace projects and the `paths` in the root `tsconfig.base.json` or `tsconfig.json`.
- A specifier that matches no project creates no edge. External packages already come from the lock file.
- Each edge is a static dependency with the source file, so `nx affected` works per file.

This step uses only the project graph data that `CreateDependenciesContext` gives. The private `TargetProjectLocator` of Nx is not used.

### 4. Generators

- `init`: adds the plugin to `nx.json` once, and adds `astro` to `devDependencies`. Other generators call it.
- `application`: creates `astro.config.mjs`, `src/pages/index.astro`, `tsconfig.json` that extends `astro/tsconfigs/strict`, and `package.json`. Options: `directory`, `name`, `tags`, `skipFormat`.

### 5. Migrations

Each Astro major gets a migration that updates the `astro` version and prints a link to the Astro upgrade guide. The first migration ships with the first Astro version after 7.

## Testing

- Unit tests with vitest for `config/`, `targets/` and `graph/`. Each rule gets a test that fails before the code exists.
- A fixture test for `graph/` with a sample `.astro` file. It covers static, dynamic, type-only and CSS imports.
- One e2e test creates a real workspace, runs the `application` generator, runs `nx build` twice, and makes sure that the second run comes from the cache.
- One e2e test makes sure that `nx graph --file` shows the edge from an Astro app to a library.

## Risks

1. Adapters write more output, for example `.netlify`, and `dist/client` with `dist/server`. The inferred `outputs` can miss it. Mitigation: an `additionalOutputs` option.
2. `@astrojs/compiler-rs` is pre-1.0. Mitigation: all AST access is in one file, with the fixture test.
3. `@astrojs/check` 0.9.12 accepts `typescript ^5 || ^6`, but `typescript@latest` is 7.0.2. A new workspace can get a peer conflict.
4. Astro 7 added `--background` and a lock file for `dev`. It is not verified how they interact with continuous tasks in Nx.
5. The repo of Nx runs `astro-docs` with custom inputs. Pure inference does not cover that case, so overrides in `project.json` must keep working. Nx merges them by default.

## Decisions

1. Package name: `@code-lovers/nx-astro` (2026-11-09). The `@code-lovers` npm organization holds the public projects. An organization can add co-maintainers, and nobody outside it can publish under the scope. `@wenu` is not used, because its packages will move to `@code-lovers`.
2. Astro 7 only (2026-11-09). The graph parser is `@astrojs/compiler-rs`, resolved from the installed `astro`. Astro 7 is the first major where that compiler is the only one. Support for Astro 6 could need a second parser for a version that is going away.

## Open decisions

None.

## Tasks

| ID | Task | Depends on |
|---|---|---|
| T1 | Create the plugin workspace with `@nx/plugin`, vitest and the e2e setup | — |
| T2 | `config/`: static parse of `astro.config.*`, with defaults and overrides | T1 |
| T3 | `targets/` and `createNodes`, with `PluginCache` | T2 |
| T4 | `graph/`: import specifiers from `.astro` files | T1 |
| T5 | `graph/`: map specifiers to projects, and `createDependencies` | T4 |
| T6 | `init` and `application` generators | T3 |
| T7 | e2e tests: cache and graph edge | T5, T6 |
| T8 | Try it on one of my Astro projects, then write the README | T7 |

## Sources

- Nx plugin pattern: `packages/vite/src/plugins/plugin.ts` in nrwl/nx at `02fbf0f57c`.
- Nx project `astro-docs/project.json`: `cwd` and continuous `serve`.
- astro@7.4.7: `dist/core/config/schemas/defaults.js`, `dist/core/config/settings.js:16`, `dist/core/compile/compile.js:2`, `astro --help`.
- @astrojs/compiler-rs@0.5.2 and @astrojs/compiler@4.0.0, measured in a scratch project.
- Prior art: `@nxtensions/astro` 19.0.1, `src/project-graph/create-dependencies.ts`.
- Nx position: https://github.com/nrwl/nx/issues/21733
