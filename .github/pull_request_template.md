## 📌 Context

<!-- Why is this change necessary? Link the issue, for example "Fixes #123". -->

## 🔁 Current behavior

<!-- What happens today? -->

## ✅ New behavior

<!-- What happens with this change? -->

## 🚦 Type of change

<!-- The Conventional Commits type of the PR title decides the release. -->

- [ ] 🐞 Bug fix (`fix:`, patch)
- [ ] ✨ Feature (`feat:`, minor)
- [ ] 💥 Breaking change (`feat!:` or `fix!:`)
- [ ] 🧾 No release (`docs:`, `chore:`, `refactor:`, `test:`, `ci:`)

## 💥 Breaking changes

<!-- If this PR breaks existing workspaces, describe the impact and the migration. Otherwise, delete this section. -->

## ☑️ Checklist

- [ ] I ran `pnpm nx affected -t lint test build typecheck` and all tasks pass.
- [ ] I added or updated tests for the change.
- [ ] I updated `packages/nx-astro/README.md` for changes to tasks, generators or options.
- [ ] My commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
