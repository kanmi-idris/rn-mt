/**
 * Provides shared interaction behavior for CLI execution.
 */
import { readSync } from "node:fs";

import type { RnMtBaselineAnalyzeReport, RnMtRepoAppKind } from "@molaidrislabs/core";

import type { RnMtCliAnalyzeBlockResult, RnMtCliIo } from "../types";

/**
 * Encapsulates interaction behavior behind a constructor-backed seam.
 */
export class RnMtCliInteractionModule {
  /**
   * Initializes the interaction with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      promptForAppKind?: (
        report: RnMtBaselineAnalyzeReport,
        io: RnMtCliIo,
      ) => RnMtRepoAppKind | null;
    } = {},
  ) {}

  /**
   * Applies app kind selection for the interaction flow.
   */
  applyAppKindSelection(
    report: RnMtBaselineAnalyzeReport,
    selectedAppKind: RnMtRepoAppKind | null,
  ): RnMtBaselineAnalyzeReport {
    if (
      !selectedAppKind ||
      !report.repo.app.candidates.includes(selectedAppKind)
    ) {
      return report;
    }

    return {
      ...report,
      status: "ok",
      repo: {
        ...report.repo,
        app: {
          ...report.repo.app,
          kind: selectedAppKind,
          candidates: [selectedAppKind],
          remediation: [],
        },
      },
    };
  }

  /**
   * Creates analyze blocked result for the interaction flow.
   */
  createAnalyzeBlockedResult(
    report: RnMtBaselineAnalyzeReport,
  ): RnMtCliAnalyzeBlockResult {
    return {
      command: "analyze",
      status: "blocked",
      analyze: report,
      reason:
        "Ambiguous repo classification requires an explicit app-kind selection.",
      remediation: report.repo.app.remediation,
    };
  }

  /**
   * Prompts for ambiguous app kind for the interaction flow.
   */
  promptForAmbiguousAppKind(
    report: RnMtBaselineAnalyzeReport,
    io: RnMtCliIo,
  ): RnMtRepoAppKind | null {
    if (this.dependencies.promptForAppKind) {
      return this.dependencies.promptForAppKind(report, io);
    }

    const { candidates } = report.repo.app;

    if (!process.stdin.isTTY) {
      return null;
    }

    io.stdout("Ambiguous repo classification detected.\n");
    io.stdout("Select the intended app kind for this run:\n");

    candidates.forEach((candidate, index) => {
      io.stdout(`${index + 1}. ${candidate}\n`);
    });

    io.stdout("Selection: ");

    while (true) {
      const response = this.readInteractiveLine();

      if (response.length === 0) {
        return null;
      }

      const selectedIndex = Number.parseInt(response, 10);

      if (
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 1 &&
        selectedIndex <= candidates.length
      ) {
        return candidates[selectedIndex - 1] ?? null;
      }

      if (
        response === "expo-managed" ||
        response === "expo-prebuild" ||
        response === "bare-react-native"
      ) {
        return candidates.includes(response) ? response : null;
      }

      io.stdout(
        "Invalid selection. Choose a number from the list or an exact app kind: ",
      );
    }
  }

  /**
   * Reads interactive line for the interaction flow.
   */
  private readInteractiveLine() {
    const buffer = Buffer.alloc(1);
    let collected = "";

    while (true) {
      const bytesRead = readSync(process.stdin.fd, buffer, 0, 1, null);

      if (bytesRead === 0) {
        return collected.trim();
      }

      const character = buffer.toString("utf8", 0, bytesRead);

      if (character === "\n") {
        return collected.trim();
      }

      if (character !== "\r") {
        collected += character;
      }
    }
  }
}
