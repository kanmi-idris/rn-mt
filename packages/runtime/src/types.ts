/**
 * Defines the public runtime type aliases exposed by @molaidrislabs/runtime.
 */
import type {
  RnMtResolvedTenantRuntime,
  RnMtRuntimeAccessors,
} from "@molaidrislabs/shared";

export type ResolvedTenantRuntime = RnMtResolvedTenantRuntime;

export type RuntimeAccessors = RnMtRuntimeAccessors<ResolvedTenantRuntime>;
