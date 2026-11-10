# Security policy

## Supported versions

Only the latest minor version of `@code-lovers/nx-astro` gets security fixes.

## Report a vulnerability

Do not open a public issue for a security problem. Report it in private with a [GitHub security advisory](https://github.com/code-lovers/nx-astro/security/advisories/new).

You get a first answer in a few days. When a fix is ready, we release it and publish the advisory. The advisory gives credit to the reporter, unless the reporter asks to stay anonymous.

## Scope

The plugin runs on the computer of the developer and in CI, with the permissions of the user. It runs `astro add` and the package manager with the integration names that you pass to the generators. The generators reject names that are not valid package names.
