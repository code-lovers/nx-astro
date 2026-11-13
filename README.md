# nx-astro

[![CI](https://github.com/code-lovers/nx-astro/actions/workflows/ci.yml/badge.svg)](https://github.com/code-lovers/nx-astro/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/code-lovers/nx-astro/badge)](https://scorecard.dev/viewer/?uri=github.com/code-lovers/nx-astro)
[![pkg.pr.new](https://pkg.pr.new/badge/code-lovers/nx-astro)](https://pkg.pr.new/~/code-lovers/nx-astro)

The source of [`@code-lovers/nx-astro`](packages/nx-astro/README.md), an Nx plugin for Astro 7. Read the [package README](packages/nx-astro/README.md) for installation and usage, and [docs/design.md](docs/design.md) for the design.

## Development

This repository is an Nx workspace that uses pnpm.

```sh
pnpm install
pnpm nx run-many -t test,typecheck,lint,build -p nx-astro
pnpm nx e2e nx-astro-e2e
pnpm check:package
pnpm exec knip
```

The e2e test publishes the plugin to a local registry, creates a new Nx workspace in the system temp folder, and runs the generators, a cached build and `nx graph` there.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the commit convention, the pull request flow and the releases.
