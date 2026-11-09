# nx-astro

The source of [`@code-lovers/nx-astro`](packages/nx-astro/README.md), an Nx plugin for Astro 7. Read the [package README](packages/nx-astro/README.md) for installation and usage, and [docs/design.md](docs/design.md) for the design.

## Development

This repository is an Nx workspace that uses pnpm.

```sh
pnpm install
pnpm nx run-many -t test,typecheck,lint,build -p nx-astro
pnpm nx e2e nx-astro-e2e
```

The e2e test publishes the plugin to a local registry, creates a new Nx workspace in the system temp folder, and runs the generators, a cached build and `nx graph` there.
