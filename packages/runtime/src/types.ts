/**
 * Defines the public runtime type aliases exposed by @_molaidrislabs/runtime.
 */
import type {
  RnMtResolvedTenantRuntime,
  RnMtRuntimeAccessors,
} from "@_molaidrislabs/shared";

export type ResolvedTenantRuntime = RnMtResolvedTenantRuntime;

export type RuntimeAccessors = RnMtRuntimeAccessors<ResolvedTenantRuntime>;
