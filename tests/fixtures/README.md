# Fixture Strategy

`rn-mt` is a repo transformation tool, so real fixture applications are the primary integration test strategy.

The intended fixture matrix for milestone 1 is:

- a bare React Native CLI app
- an Expo managed app
- an Expo prebuild app
- a deliberately messy existing app with custom scripts, mixed config, and unusual layout

Each integration test should copy a committed fixture template into a temporary workspace, run one or more `rn-mt` commands, and assert on external behavior:

- generated files
- rewritten config
- script wiring
- JSON output
- audit findings
- handoff isolation once milestone 2 begins
