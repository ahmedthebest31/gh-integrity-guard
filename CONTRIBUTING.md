# Contributing

Thanks for considering a contribution to GitHub Integrity Guard.

## Getting started

1. Open an issue or a discussion before starting a larger change, so we can agree on the direction.
2. Fork the repository and create a branch for your work.
3. Follow the project's existing style: plain JavaScript, no build step, no dependencies.
4. Keep the extension fully accessible. That means no non-semantic charts, real headings and labels, keyboard support for every control, and screen-reader friendly announcements for new content.

## Commit messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) specification. Examples:

- `fix(ui): handle the rate limit error card gracefully`
- `feat(core): add a new scoring signal`
- `docs: clarify the token setup steps`

## Running the extension

The extension loads unpacked from the `src` folder (see the README install section). For a lower GitHub API rate limit, add a Personal Access Token in the Options page.

## Before you open a pull request

- Test the change on both a repository with a sidebar and one without, so the floating card fallback is covered.
- Check that nothing is logged or exposed that does not need to be, and that no secrets end up in the repo.
- Summarize what changed and roughly why in the pull request description.