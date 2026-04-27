/**
 * Defines the public runtime type aliases exposed by @rn-mt/runtime.
 */
import type {
  RnMtResolvedTenantRuntime,
  RnMtRuntimeAccessors,
} from "@rn-mt/shared";

export type ResolvedTenantRuntime = RnMtResolvedTenantRuntime;

export type RuntimeAccessors = RnMtRuntimeAccessors<ResolvedTenantRuntime>;
