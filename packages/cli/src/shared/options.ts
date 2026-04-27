/**
 * Provides shared options behavior for CLI execution.
 */
import type { RnMtRepoAppKind } from "@rn-mt/core";
import type { RnMtTargetPlatform } from "@rn-mt/shared";

/**
 * Encapsulates options behavior behind a constructor-backed seam.
 */
export class RnMtCliOptionsModule {
  readonly optionArgs: string[];
  readonly passthroughArgs: string[];

  /**
   * Initializes the options with its shared dependencies.
   */
  constructor(
    private readonly commandArgs: string[],
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    const separatorIndex = commandArgs.indexOf("--");

    if (separatorIndex === -1) {
      this.optionArgs = commandArgs;
      this.passthroughArgs = [];
      return;
    }

    this.optionArgs = commandArgs.slice(0, separatorIndex);
    this.passthroughArgs = commandArgs.slice(separatorIndex + 1);
  }

  /**
   * Returns the default working directory for the current CLI invocation.
   */
  getDefaultExecutionCwd() {
    return this.env.INIT_CWD ?? this.env.PWD ?? process.cwd();
  }

  /**
   * Checks whether the current invocation requested help output.
   */
  wantsHelpOutput() {
    return this.optionArgs.includes("--help") || this.optionArgs.includes("-h");
  }

  /**
   * Checks whether the current invocation requested JSON output.
   */
  wantsJsonOutput() {
    return this.optionArgs.includes("--json");
  }

  /**
   * Checks whether the current invocation disabled interactive prompts.
   */
  isNonInteractive() {
    return this.optionArgs.includes("--non-interactive");
  }

  /**
   * Returns true when the current invocation contains the given flag.
   */
  hasFlag(flagName: string) {
    return this.optionArgs.includes(flagName);
  }

  /**
   * Returns a required option value or throws when the option is missing.
   */
  getRequiredOption(optionName: string) {
    const rawValue = this.getOptionalOptionValue(optionName);

    if (!rawValue) {
      throw new Error(`Missing required option: ${optionName}`);
    }

    return rawValue;
  }

  /**
   * Parses the explicit --app-kind override when one was provided.
   */
  getSelectedAppKind(): RnMtRepoAppKind | null {
    const rawValue = this.getOptionalOptionValue("--app-kind");

    if (!rawValue) {
      return null;
    }

    if (
      rawValue === "expo-managed" ||
      rawValue === "expo-prebuild" ||
      rawValue === "bare-react-native"
    ) {
      return rawValue;
    }

    throw new Error(
      `Unsupported --app-kind value: ${rawValue}. Expected expo-managed, expo-prebuild, or bare-react-native.`,
    );
  }

  /**
   * Parses the explicit --platform override when one was provided.
   */
  getSelectedPlatform(): RnMtTargetPlatform | null {
    const rawValue = this.getOptionalOptionValue("--platform");

    if (!rawValue) {
      return null;
    }

    if (rawValue === "ios" || rawValue === "android") {
      return rawValue;
    }

    throw new Error(
      `Unsupported --platform value: ${rawValue}. Expected ios or android.`,
    );
  }

  /**
   * Returns the optional bridge config module path used during convert.
   */
  getSelectedBridgeConfigModulePath() {
    return this.getOptionalOptionValue("--bridge-config");
  }

  /**
   * Returns the optional display name provided for tenant add or rename flows.
   */
  getSelectedTenantDisplayName() {
    return this.getOptionalOptionValue("--display-name") ?? undefined;
  }

  /**
   * Returns the explicit app root override for monorepo-aware commands.
   */
  getSelectedAppRoot() {
    return this.getOptionalOptionValue("--app-root");
  }

  /**
   * Returns the explicit manifest path override for commands that accept it.
   */
  getSelectedConfigPath() {
    return this.getOptionalOptionValue("--config");
  }

  /**
   * Parses the audit fail threshold when one was provided.
   */
  getAuditFailThreshold() {
    const rawValue = this.getOptionalOptionValue("--fail-on");

    if (!rawValue) {
      return null;
    }

    if (
      rawValue === "P0" ||
      rawValue === "P1" ||
      rawValue === "P2" ||
      rawValue === "P3"
    ) {
      return rawValue;
    }

    throw new Error(
      `Unsupported --fail-on value: ${rawValue}. Expected P0, P1, P2, or P3.`,
    );
  }

  /**
   * Returns the repeated audit ignore rules collected from --ignore flags.
   */
  getAuditIgnoreRules() {
    return this.getRepeatedOptionValues("--ignore");
  }

  /**
   * Collects repeated option values, splitting comma-delimited entries into a
   * flat list.
   */
  private getRepeatedOptionValues(optionName: string) {
    const values: string[] = [];

    for (let index = 0; index < this.optionArgs.length; index += 1) {
      if (this.optionArgs[index] !== optionName) {
        continue;
      }

      const rawValue = this.optionArgs[index + 1];

      if (!rawValue || rawValue.startsWith("--")) {
        throw new Error(`Option requires a value: ${optionName}`);
      }

      values.push(
        ...rawValue
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
      );
    }

    return values;
  }

  /**
   * Returns the value immediately following an option flag, or null when the
   * option is absent.
   */
  private getOptionalOptionValue(optionName: string) {
    const optionIndex = this.optionArgs.indexOf(optionName);
    const rawValue =
      optionIndex === -1 ? undefined : this.optionArgs[optionIndex + 1];

    if (!rawValue || rawValue.startsWith("--")) {
      return null;
    }

    return rawValue;
  }
}
