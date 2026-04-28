"use client";

import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import { CheckIcon, CopyIcon, TerminalIcon } from "./icons";

type CodeBlockProps = {
  code: string;
  language?: string | null;
};

function normalizeLanguage(language?: string | null) {
  if (!language) {
    return "text";
  }

  if (language === "sh" || language === "shell") {
    return "bash";
  }

  return language;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const normalizedLanguage = useMemo(
    () => normalizeLanguage(language),
    [language],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="docs-code-block">
      <div className="docs-code-block__header">
        <span className="docs-code-block__language">
          <TerminalIcon className="docs-button__icon" />
          {normalizedLanguage}
        </span>
        <button
          type="button"
          className="docs-code-block__copy"
          onClick={handleCopy}
          aria-label={copied ? "Copied code block" : "Copy code block"}
        >
          {copied ? (
            <CheckIcon className="docs-button__icon" />
          ) : (
            <CopyIcon className="docs-button__icon" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={normalizedLanguage}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "1rem 1.1rem 1.15rem",
        }}
        codeTagProps={{ className: "docs-code-block__code" }}
        PreTag="pre"
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
