/**
 * Applies rn-mt target context onto Expo config.
 */
import { getRnMtExtra } from "./extra";

import type { ExpoConfigLike, RnMtExpoTargetContext } from "./types";

/**
 * Applies expo target context.
 */
export function applyExpoTargetContext<TConfig extends ExpoConfigLike>(
  baseConfig: TConfig,
  targetContext: RnMtExpoTargetContext,
): TConfig & ExpoConfigLike {
  const existingRnMtExtra = getRnMtExtra(baseConfig.extra);

  return {
    ...baseConfig,
    name: targetContext.identity.displayName,
    ...(targetContext.expo?.slug ? { slug: targetContext.expo.slug } : {}),
    ...(targetContext.expo?.scheme
      ? { scheme: targetContext.expo.scheme }
      : {}),
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
