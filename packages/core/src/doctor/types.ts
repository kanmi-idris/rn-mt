export type RnMtDoctorCheckStatus = "ok" | "warning";

export interface RnMtDoctorCheck {
  code:
    | "expo-distribution-config"
    | "android-release-integration"
    | "ios-release-integration";
  status: RnMtDoctorCheckStatus;
  summary: string;
  details: string[];
}

export interface RnMtDoctorResult {
  rootDir: string;
  checks: RnMtDoctorCheck[];
}
