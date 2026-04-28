import Link from "next/link";
import { notFound } from "next/navigation";

import { DocMarkdown } from "../../components/doc-markdown";
import { DocsShell } from "../../components/docs-shell";
import { DocTabs } from "../../components/doc-tabs";
import {
  EditIcon,
  ExternalLinkIcon,
  SparkleIcon,
  TocIcon,
} from "../../components/icons";
import {
  getDocBySlug,
  getDocPageMetadata,
  stripLeadingTitle,
  toSlugPath,
} from "../../lib/docs";

import type { Metadata } from "next";

const slug = ["get-started"];

export function generateMetadata(): Metadata {
  const page = getDocBySlug(slug);

  if (!page) {
    return {};
  }

  const metadata = getDocPageMetadata(page);
  return {
    title: metadata.title,
    description: metadata.description,
  };
}

export default function GetStartedPage() {
  const manualNavPage = getDocBySlug(slug);
  const agentNavPage = getDocBySlug(["agent-skill"]);

  if (!manualNavPage || !agentNavPage) {
    notFound();
  }

  const manualPage = getDocPageMetadata(manualNavPage);
  const agentPage = getDocPageMetadata(agentNavPage);
  const shellPage = {
    ...manualPage,
    headings: [],
  };

  const sidebar = (
    <aside className="docs-toc" aria-label="Get started sidebar">
      <div className="docs-toc__actions">
        <a
          href={manualPage.editUrl}
          target="_blank"
          rel="noreferrer"
          className="docs-button docs-button--sidebar"
        >
          <EditIcon className="docs-button__icon" />
          Edit
        </a>
        <a
          href={manualPage.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="docs-button docs-button--sidebar"
          aria-label="View source"
          title="View source"
        >
          <ExternalLinkIcon className="docs-button__icon" />
          Source
        </a>
      </div>
      <p className="docs-toc__title">
        <TocIcon className="docs-section-icon" />
        <span>In this guide</span>
      </p>
      <ul className="docs-toc__list">
        <li className="docs-toc__item depth-2">Manual setup</li>
        <li className="docs-toc__item depth-2">Agent setup</li>
        <li className="docs-toc__item depth-2">
          <Link href={`/${toSlugPath(agentPage.slug)}`}>
            Open the standalone Agent Skill page
          </Link>
        </li>
      </ul>
      <p className="docs-toc__note">
        The agent tab mirrors the full Agent Skill page, so you can start here
        and jump to the dedicated page when you want the install guide on its
        own.
      </p>
    </aside>
  );

  const content = (
    <>
      <h1>Get Started</h1>
      <p>
        Pick the path that matches how you want to work. Use <strong>Manual</strong>{" "}
        when you want the raw CLI flow. Use <strong>Agent</strong> when you want
        the repo skill to carry the repo-specific debugging, verification, and
        issue-reporting workflow for you.
      </p>
      <DocTabs
        manualContent={
          <DocMarkdown content={stripLeadingTitle(manualPage.content)} />
        }
        agentContent={
          <>
            <div className="docs-tabs__panel-intro">
              <p className="docs-tabs__badge">
                <SparkleIcon className="docs-inline-icon" />
                Agent workflow
              </p>
            </div>
            <DocMarkdown content={stripLeadingTitle(agentPage.content)} />
          </>
        }
        agentHref={`/${toSlugPath(agentPage.slug)}`}
        idPrefix="get-started"
      />
    </>
  );

  return <DocsShell page={shellPage} content={content} sidebar={sidebar} />;
}
