# Introduction

`rn-mt` helps you take one React Native or Expo app and turn it into one repo
that can ship many branded apps.

Use it when:

- you already have a real app
- you want to keep shared code in one place
- you need tenant-specific branding, content, or config
- you want the generated native and runtime files to stay predictable

## What the package gives you

- one manifest: `rn-mt.config.json`
- one shared source tree: `src/rn-mt/shared`
- one tenant override tree: `src/rn-mt/tenants/<tenant-id>`
- one generated app-facing surface: `src/rn-mt/current`

That `current` folder matters. Your app should read from it. `rn-mt` keeps it
pointing at the active tenant for you.

## The normal flow

Run these commands when you want to move an app into the multi-tenant setup:

```bash
rn-mt analyze
rn-mt init
rn-mt convert
rn-mt sync
rn-mt start
```

## The terms you will see everywhere

### Tenant

A tenant is one branded version of the app.

Examples:

- `northstar`
- `orchid`
- `volt`

### Environment

An environment is a stage like:

- `dev`
- `staging`
- `prod`

### Target

A target is one exact choice, such as:

- `northstar + dev`
- `orchid + prod + ios`

### Manifest

The manifest is `rn-mt.config.json`.

It decides:

- which tenants exist
- which environments exist
- the default target
- layered config overrides
- env validation rules

## What `rn-mt` is good at

- converting a real app instead of starting from a demo template
- keeping tenant differences explicit
- generating reviewable files instead of hiding work at runtime
- catching tenant leakage with audit
- exporting one tenant later with handoff

## What it does not try to do

- store secrets
- switch tenants inside one shipped app at runtime
- guess through every unusual repo shape silently
- act like a plugin marketplace

## Supported repo kinds

Today the CLI reports one of these kinds:

- `expo-managed`
- `expo-prebuild`
- `bare-react-native`

Some repos are fully supported. Some are near-supported. `analyze` tells you
which one you have before you start moving files around.
