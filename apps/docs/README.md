# rn-mt Docs App

This is the deployable developer documentation site for `rn-mt`.

It is a small Next.js app that reads committed markdown files from the main repo and renders them as a docs site with:

- left sidebar navigation
- route-based static pages
- page-level GitHub edit links
- page-level GitHub source links
- table of contents generated from markdown headings

## Local development

From the repo root:

```sh
pnpm docs:dev
```

Then open the local Next.js server shown in the terminal.

## Production build

From the repo root:

```sh
pnpm docs:build
pnpm docs:start
```

## GitHub Pages deployment

This repo now includes a GitHub Pages workflow at `.github/workflows/docs-pages.yml`.

It works by:

1. installing the monorepo
2. building the docs app as a static export
3. uploading `apps/docs/out`
4. deploying that artifact with GitHub Pages Actions

The docs app automatically switches into GitHub Pages mode during Actions builds:

- `output: "export"`
- `trailingSlash: true`
- `images.unoptimized: true`
- `basePath` and `assetPrefix` set to the repository name, which is currently `/rn-mt`

That means local development stays clean at `/`, while Pages deployment works under the project-site path.

## Content source

The app does not keep its own copy of the docs.

It renders developer-facing content from committed markdown files under:

- `docs/developer/`

The route map for those files lives in `apps/docs/lib/docs.ts`.

## GitHub buttons

Each page exposes:

- `Edit page`
- `View source`

Those links are derived from the real repo file path and point at:

- `https://github.com/kanmi-idris/rn-mt/edit/main/...`
- `https://github.com/kanmi-idris/rn-mt/blob/main/...`

## Deployment note

This app is designed to deploy like a normal Next.js site.

The simplest deployment model is:

- choose `apps/docs` as the app root in your hosting platform
- run `pnpm install`
- run `pnpm docs:build` or the package-local `pnpm build`

Because the app reads markdown files from the repo, the deploy target should build from the full monorepo checkout, not from an isolated docs-only export.
