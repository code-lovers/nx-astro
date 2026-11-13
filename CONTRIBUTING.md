# Contributing to nx-astro

This guide tells you how to set up the repository, how to write commits, and how a change gets to npm. For a bug or a feature request, open an issue first with one of the issue forms. For a security problem, do not open a public issue. Read [SECURITY.md](SECURITY.md).

## Quick path

1. Install Node.js 24 and pnpm 12, then run `pnpm install`.
2. Create a branch from `main` and make your change.
3. Run the checks in [Run the checks](#run-the-checks).
4. Commit with a [Conventional Commits](#write-commits) message.
5. Open a pull request and fill in the template.
6. Make sure that the `main` and `lint` checks pass.

## Set up the repository

CI uses Node.js 24. The `packageManager` field in `package.json` gives the pnpm version, so Corepack can install it.

```sh
pnpm install
```

`pnpm install` also installs two git hooks:

| Hook         | What it does                            |
| ------------ | --------------------------------------- |
| `pre-commit` | Formats the staged files with Prettier. |
| `commit-msg` | Runs commitlint on the commit message.  |

## Run the checks

CI runs the same commands on each pull request.

```sh
pnpm nx run-many -t test,typecheck,lint,build -p nx-astro
pnpm nx e2e nx-astro-e2e
pnpm check:package
pnpm exec knip
```

The e2e test takes a few minutes. It publishes the plugin to a local registry and creates a new Nx workspace in the system temp folder. Then it runs the generators, a cached build and `nx graph` in that workspace.

If you change a task, a generator or an option, update [packages/nx-astro/README.md](packages/nx-astro/README.md) in the same pull request.

## Write commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). The type decides the next release:

| Type                                           | Release                                    |
| ---------------------------------------------- | ------------------------------------------ |
| `fix:`                                         | Patch                                      |
| `feat:`                                        | Minor                                      |
| `feat!:` or `fix!:`                            | Minor while the version is 0.x, then major |
| `docs:`, `chore:`, `refactor:`, `test:`, `ci:` | No release                                 |

Use the type that a user of the package sees. A change to the README only is `docs:`, also when it documents a fix.

## Open a pull request

The `main` branch accepts a change only through a pull request. The `main` and `lint` checks must pass before the merge.

Each pull request gets a preview package from [pkg.pr.new](https://pkg.pr.new). The `pkg-pr-new` bot comment on the pull request gives the install command. Use it to test the change in another workspace before the release.

## Releases

You do not publish by hand:

1. After a merge to `main`, [release-please](https://github.com/googleapis/release-please) opens or updates a release pull request. It contains the next version and the changelog.
2. A maintainer merges the release pull request.
3. The release workflow publishes the package to npm with provenance, through npm trusted publishing.

Renovate opens the pull requests for dependency updates on Monday mornings.
