import Link from "next/link";
import { RocketIcon, SparkleIcon } from "./icons";

import type { ReactNode } from "react";

type DocTabsProps = {
  manualContent: ReactNode;
  agentContent: ReactNode;
  agentHref: string;
  idPrefix?: string;
};

export function DocTabs({
  manualContent,
  agentContent,
  agentHref,
  idPrefix = "docs-tabs",
}: DocTabsProps) {
  const manualId = `${idPrefix}-manual`;
  const agentId = `${idPrefix}-agent`;

  return (
    <div className="docs-tabs">
      <input
        className="docs-tabs__input"
        type="radio"
        name={idPrefix}
        id={manualId}
        defaultChecked
      />
      <input
        className="docs-tabs__input"
        type="radio"
        name={idPrefix}
        id={agentId}
      />

      <div className="docs-tabs__controls" role="tablist" aria-label="Get started mode">
        <label className="docs-tabs__label docs-tabs__label--manual" htmlFor={manualId}>
          <RocketIcon className="docs-inline-icon" />
          Manual
        </label>
        <label className="docs-tabs__label docs-tabs__label--agent" htmlFor={agentId}>
          <SparkleIcon className="docs-inline-icon" />
          Agent
        </label>
      </div>

      <div className="docs-tabs__panels">
        <section className="docs-tabs__panel docs-tabs__panel--manual">
          {manualContent}
        </section>
        <section className="docs-tabs__panel docs-tabs__panel--agent">
          {agentContent}
          <p className="docs-tabs__note">
            Want the standalone version? Open <Link href={agentHref}>Agent Skill</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
