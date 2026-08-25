# SpaceShaman blog

A minimal bilingual Hugo blog using PaperMod as a Hugo Module.

## Local development

Requirements: Hugo Extended 0.165.0 or newer, Go 1.24 or newer, and Git.

```sh
hugo mod get
hugo server -D
```

Open <http://localhost:1313>. English is the default language; Polish content is available under `/pl/`.

## Publishing

The workflow in `.github/workflows/hugo.yaml` builds and deploys every push to `master`. In the repository settings, select **Settings → Pages → Source → GitHub Actions** once.

