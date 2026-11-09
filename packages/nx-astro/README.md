<div align="center">

# nx-astro

[![npm version](https://img.shields.io/npm/v/@code-lovers/nx-astro.svg)](https://www.npmjs.com/package/@code-lovers/nx-astro)
[![Nx](https://img.shields.io/badge/Nx-24-143055?logo=nx)](https://nx.dev)
[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)](https://astro.build)

An [Nx](https://nx.dev) plugin for [Astro](https://astro.build) projects: cached tasks with no `project.json`, graph edges from `.astro` imports, and generators for apps and integrations.

[Features](#features) • [Requirements](#requirements) • [Getting started](#getting-started) • [Tasks](#tasks) • [Generators](#generators) • [Plugin options](#plugin-options) • [Known limitations](#known-limitations)

</div>

## Features

- **Inferred tasks.** The plugin finds each `astro.config.*` file and adds `build`, `sync`, `dev`, `preview` and `check` tasks to that project. You do not write targets in `project.json`.
- **Cache that works.** `build` and `sync` declare their inputs and outputs, so Nx restores `dist/` from the cache and runs the build again only when a source file, a dependency project or the `astro` version changes.
- **Project graph edges.** When a `.astro` file imports a file or a package of another project, `nx graph` shows the edge, and `nx affected` uses it.
- **Generators.** `application` creates an Astro project, adds it to the workspaces of the package manager, and runs `astro add` for the integrations that you select. `integration` adds integrations to an existing project.

## Requirements

| Dependency | Version                                   |
| ---------- | ----------------------------------------- |
| `nx`       | 24 or later                               |
| `astro`    | 7 or later                                |
| Node.js    | 22.23.4 or later (the minimum of Astro 7) |

## Getting started

Add the plugin to your Nx workspace:

```sh
npx nx add @code-lovers/nx-astro
```

The command installs the package, registers `@code-lovers/nx-astro/plugin` in `nx.json`, and adds `.astro/` to the root `.gitignore`.

> [!IMPORTANT]
> Astro writes generated types to `.astro/` in each project. If git does not ignore that folder, the input hash changes after each build and Nx never reads the build from the cache. Keep `.astro/` in `.gitignore`.

Create an Astro application with React and MDX:

```sh
npx nx g @code-lovers/nx-astro:application apps/site --integrations=react,mdx
```

Build it, and run it in development:

```sh
npx nx build site
npx nx dev site
```

Run `npx nx build site` again. Nx reads the output from the cache.

## Tasks

The plugin adds these tasks to each folder that contains an `astro.config.mjs`, `.js`, `.ts` or `.mts` file.

| Task      | Command         | Cached | Notes                                                                               |
| --------- | --------------- | ------ | ----------------------------------------------------------------------------------- |
| `build`   | `astro build`   | Yes    | Runs `build` of the dependency projects first. Outputs: the `outDir` and `.astro/`. |
| `sync`    | `astro sync`    | Yes    | Generates the types in `.astro/`.                                                   |
| `dev`     | `astro dev`     | No     | Continuous task.                                                                    |
| `preview` | `astro preview` | No     | Continuous task. Runs `build` first.                                                |
| `check`   | `astro check`   | Yes    | Added only when `@astrojs/check` is installed.                                      |

To see the tasks of a project, run `npx nx show project site`.

The plugin reads `root` and `outDir` from the Astro config file without running it. It reads literal values only. If a value is computed, for example `outDir: process.env.OUT`, the plugin uses the Astro default (`./dist`) or the value from the [plugin options](#plugin-options).

### Type checking

Use the `check` task to check the types of an Astro project. It runs `astro check`, which checks `.astro` files as well as `.ts` files.

```sh
npm add -D @astrojs/check typescript@6
npx nx check site
```

> [!NOTE]
> `@astrojs/check` 0.9 supports TypeScript 5 and 6 only. It stops with an error on TypeScript 7.

> [!TIP]
> On pnpm 12, `@astrojs/check` can install a beta of `@emnapi/runtime` that crashes at start. Astro then reports that `@astrojs/check` is not installed. Pin the stable version in `pnpm-workspace.yaml`:
>
> ```yaml
> overrides:
>   '@emnapi/runtime': 1.11.3
> ```

The `@nx/js/typescript` plugin cannot type check Astro projects. Astro configures `noEmit`, so that plugin adds a `typecheck` task that only prints a message, and `tsc` does not read `.astro` files. For this reason, the `application` generator turns that task off in the `tsconfig.json` of the project:

```json
{
  "nx": { "addTypecheckTarget": false }
}
```

When you run type checks for the whole workspace, include `check`:

```sh
npx nx affected -t typecheck check
```

## Generators

### `application`

Creates an Astro project in a folder. The alias is `app`.

```sh
npx nx g @code-lovers/nx-astro:application apps/site
```

| Option         | Description                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `directory`    | The folder of the project, relative to the workspace root. Positional.                                                        |
| `name`         | The package name. The default is the last segment of `directory`.                                                             |
| `tags`         | Tags for the project, separated by commas.                                                                                    |
| `integrations` | Astro integrations that `astro add` adds after the install, for example `react,mdx`. Without this option, the generator asks. |
| `skipFormat`   | Do not format the generated files.                                                                                            |

The generator writes `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro` and `package.json`. Then it installs the packages and runs `astro add` in the project folder.

If the workspace uses package manager workspaces (`pnpm-workspace.yaml` or `workspaces` in `package.json`), the generator adds the folder to them, like the Nx application generators do. Otherwise, it writes a `project.json`.

### `integration`

Adds Astro integrations to an existing Astro project.

```sh
npx nx g @code-lovers/nx-astro:integration site --integrations=sitemap
```

| Option         | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `project`      | The Nx project. It must have an Astro config file.                |
| `integrations` | The integrations to add, for example `sitemap` or `@astrojs/mdx`. |

## Plugin options

Set the options in the `nx.json` entry of the plugin:

```json
{
  "plugins": [
    {
      "plugin": "@code-lovers/nx-astro/plugin",
      "options": {
        "buildTargetName": "astro-build",
        "outDir": "./public-dist"
      }
    }
  ]
}
```

| Option              | Default                        | Description                                      |
| ------------------- | ------------------------------ | ------------------------------------------------ |
| `buildTargetName`   | `build`                        | The name of the build task.                      |
| `syncTargetName`    | `sync`                         | The name of the sync task.                       |
| `devTargetName`     | `dev`                          | The name of the dev task.                        |
| `previewTargetName` | `preview`                      | The name of the preview task.                    |
| `checkTargetName`   | `check`                        | The name of the check task.                      |
| `root`              | From the config, else `.`      | The Astro `root`, when the config computes it.   |
| `outDir`            | From the config, else `./dist` | The Astro `outDir`, when the config computes it. |

## Known limitations

- The plugin finds graph edges in `.astro` files only. Imports in `.md`, `.mdx` and `.mdoc` files give no edge. Imports in `.ts` and `.js` files get their edges from Nx.
- If the config exports a variable (`export default config`), the plugin cannot read it and uses the defaults or the plugin options.
- The graph edge does not link the package. To import a workspace package at build time, add it to the `dependencies` of the Astro project, for example `"@acme/ui": "workspace:*"` with pnpm.
