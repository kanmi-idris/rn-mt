export interface ExpoPluginBridgeContract {
  targetContextSource: "rn-mt-state";
  computedAuthority: "app.config.ts";
  preservesAppJsonLayering: true;
}

export interface RnMtExpoTargetContext {
  schemaVersion: 1;
  target: {
    tenant: string;
    environment: string;
    platform?: "ios" | "android";
  };
  identity: {
    displayName: string;
    nativeId: string;
  };
  runtimeConfigPath: string;
  iconPath?: string;
}

export interface ExpoConfigLike {
  name?: string;
  slug?: string;
  icon?: string;
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

function getRnMtExtra(extra: Record<string, unknown> | undefined) {
  const rnMt = extra?.rnMt;
  return rnMt && typeof rnMt === "object" && !Array.isArray(rnMt)
    ? (rnMt as Record<string, unknown>)
    : {};
}

export const expoPluginBridgeContract: ExpoPluginBridgeContract = {
  targetContextSource: "rn-mt-state",
  computedAuthority: "app.config.ts",
  preservesAppJsonLayering: true,
};

export function applyExpoTargetContext<TConfig extends ExpoConfigLike>(
  baseConfig: TConfig,
  targetContext: RnMtExpoTargetContext,
): TConfig & ExpoConfigLike {
  const existingRnMtExtra = getRnMtExtra(baseConfig.extra);

  return {
    ...baseConfig,
    name: targetContext.identity.displayName,
    ...(targetContext.iconPath ? { icon: targetContext.iconPath } : {}),
    ios: {
      ...(baseConfig.ios ?? {}),
      bundleIdentifier: targetContext.identity.nativeId,
    },
    android: {
      ...(baseConfig.android ?? {}),
      package: targetContext.identity.nativeId,
    },
    extra: {
      ...(baseConfig.extra ?? {}),
      rnMt: {
        ...existingRnMtExtra,
        target: targetContext.target,
        runtimeConfigPath: targetContext.runtimeConfigPath,
      },
    },
  };
}
