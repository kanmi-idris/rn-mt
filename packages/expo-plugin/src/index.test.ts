import { describe, expect, it } from "vitest";

import { applyExpoTargetContext, expoPluginBridgeContract } from "./index";

describe("expo plugin bridge", () => {
  it("keeps the bridge contract stable", () => {
    expect(expoPluginBridgeContract).toEqual({
      targetContextSource: "rn-mt-state",
      computedAuthority: "app.config.ts",
      preservesAppJsonLayering: true,
    });
  });

  it("applies explicit rn-mt target context onto Expo config", () => {
    const result = applyExpoTargetContext(
      {
        slug: "keep-nexus",
        extra: {
          base: true,
        },
      },
      {
        schemaVersion: 1,
        target: {
          tenant: "acme",
          environment: "dev",
          platform: "ios",
        },
        identity: {
          displayName: "Keep Nexus (Dev)",
          nativeId: "com.keep.nexus.dev",
        },
        runtimeConfigPath: "./rn-mt.generated.runtime.json",
        iconPath: "./ios/rn-mt.generated.icon.dev.svg",
        expo: {
          slug: "keep-nexus-dev",
          scheme: "keepnexusdev",
        },
      },
    );

    expect(result).toEqual({
      slug: "keep-nexus-dev",
      scheme: "keepnexusdev",
      name: "Keep Nexus (Dev)",
      icon: "./ios/rn-mt.generated.icon.dev.svg",
      ios: {
        bundleIdentifier: "com.keep.nexus.dev",
      },
      android: {
        package: "com.keep.nexus.dev",
      },
      extra: {
        base: true,
        rnMt: {
          target: {
            tenant: "acme",
            environment: "dev",
            platform: "ios",
          },
          runtimeConfigPath: "./rn-mt.generated.runtime.json",
        },
      },
    });
  });

  it("preserves existing rn-mt extra keys while layering resolved target context", () => {
    const result = applyExpoTargetContext(
      {
        slug: "keep-nexus",
        scheme: "keepnexus",
        extra: {
          base: true,
          rnMt: {
            preserved: true,
          },
        },
      },
      {
        schemaVersion: 1,
        target: {
          tenant: "acme",
          environment: "staging",
          platform: "ios",
        },
        identity: {
          displayName: "Keep Nexus (Staging)",
          nativeId: "com.keep.nexus.staging",
        },
        runtimeConfigPath: "./rn-mt.generated.runtime.json",
      },
    );

    expect(result).toEqual({
      name: "Keep Nexus (Staging)",
      slug: "keep-nexus",
      scheme: "keepnexus",
      ios: {
        bundleIdentifier: "com.keep.nexus.staging",
      },
      android: {
        package: "com.keep.nexus.staging",
      },
      extra: {
        base: true,
        rnMt: {
          preserved: true,
          target: {
            tenant: "acme",
            environment: "staging",
            platform: "ios",
          },
          runtimeConfigPath: "./rn-mt.generated.runtime.json",
        },
      },
    });
  });
});
