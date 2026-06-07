# Example Matrix

The `examples/` folder has two fixture modes.

## Source Fixtures

These stay as pre-conversion apps. Verification copies them into `tests/tmp/examples/*`, runs `rn-mt` conversion commands against the copies, rewrites the converted rn-mt package dependency to a local `link:` spec, installs dependencies as a standalone sandbox, and checks that each app still works after conversion.

- `expo-managed-greenfield`: clean Expo managed TypeScript app based on the current Expo blank TypeScript template surface
- `expo-prebuild-greenfield`: clean Expo prebuild app based on the current Expo bare minimum template surface
- `bare-react-native-greenfield`: clean bare React Native app based on the upstream React Native HelloWorld template surface
- `expo-managed-brownfield`: intentionally messy existing Expo app with aliases, extra scripts, config/theme folders, env files, and app-config layering

## Committed Multitenant Fixtures

Committed multitenant fixtures are already converted and committed as multitenant repos. Verification copies them into `tests/tmp/examples/*`, rewrites local `@_molaidrislabs/*` package links for the standalone sandbox, retargets the manifest root to the sandbox path, and then loops through each committed tenant with `target set`, `sync`, typecheck, config smoke, start smoke, and audit.

There are no committed multitenant fixtures in this checkout yet. When one is added under `examples/<name>`, include an `rn-mt.example.json` metadata file so `pnpm examples:verify` can discover and run it.
