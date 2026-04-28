import Link from "next/link";
import React from "react";

import { DocMarkdown } from "./doc-markdown";
import {
  AlertIcon,
  ArchitectureIcon,
  BookIcon,
  BranchIcon,
  EditIcon,
  ExternalLinkIcon,
  FlaskIcon,
  GithubIcon,
  HookIcon,
  LayersIcon,
  RocketIcon,
  SparkleIcon,
  SyncIcon,
  TerminalIcon,
  TocIcon,
} from "./icons";

import {
  docsNavigation,
  getAdjacentDocLinks,
  repoGitHubUrl,
  toSlugPath,
} from "../lib/docs";

import type { DocPageMetadata, DocSection } from "../lib/docs";

type DocsShellProps = {
  page: DocPageMetadata;
  content?: React.ReactNode;
  sidebar?: React.ReactNode | null;
};

const sectionIconMap = {
  "Start Here": RocketIcon,
  Guides: LayersIcon,
  Project: BranchIcon,
} as const;

const pageIconMap = {
  introduction: BookIcon,
  "get-started": RocketIcon,
  "convert-an-app": LayersIcon,
  "targets-and-sync": SyncIcon,
  "workflow-hooks": HookIcon,
  "agent-skill": SparkleIcon,
  "command-reference": TerminalIcon,
  examples: FlaskIcon,
  architecture: ArchitectureIcon,
  contributing: BranchIcon,
  troubleshooting: AlertIcon,
} as const;

function renderSection(section: DocSection, currentPath: string) {
  const SectionIcon = sectionIconMap[section.title as keyof typeof sectionIconMap];
  return (
    <section className="docs-sidebar__section" key={section.title}>
      <p className="docs-sidebar__section-title">
        {SectionIcon ? <SectionIcon className="docs-section-icon" /> : null}
        <span>{section.title}</span>
      </p>
      <ul className="docs-sidebar__list">
        {section.items.map((item) => {
          const href = `/${toSlugPath(item.slug)}`;
          const isActive = href === currentPath;
          const pageKey = toSlugPath(item.slug) as keyof typeof pageIconMap;
          const PageIcon = pageIconMap[pageKey];

          return (
            <li key={item.filePath}>
              <Link
                href={href}
                className={`docs-sidebar__link${isActive ? " is-active" : ""}`}
              >
                {PageIcon ? <PageIcon className="docs-nav-icon" /> : null}
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DocsShell({ page, content, sidebar }: DocsShellProps) {
  const currentPath = `/${toSlugPath(page.slug)}`;
  const hasHeadings = page.headings.length > 0;
  const { previous, next } = getAdjacentDocLinks(page.slug);
  const defaultSidebar = hasHeadings ? (
    <aside className="docs-toc" aria-label="Table of contents">
      <div className="docs-toc__actions">
        <a
          href={page.editUrl}
          target="_blank"
          rel="noreferrer"
          className="docs-button docs-button--sidebar"
        >
          <EditIcon className="docs-button__icon" />
          Edit
        </a>
        <a
          href={page.sourceUrl}
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
        <span>On this page</span>
      </p>
      <ul className="docs-toc__list">
        {page.headings.map((heading) => (
          <li
            key={`${heading.depth}-${heading.id}`}
            className={`docs-toc__item depth-${heading.depth}`}
          >
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </aside>
  ) : null;

  return (
    <div className="docs-app-shell">
      <aside className="docs-sidebar">
        <div className="docs-sidebar__brand">
          <Link href="/introduction" className="docs-sidebar__brand-link">
            rn-mt
          </Link>
        </div>
        <nav aria-label="Documentation navigation">
          {docsNavigation.map((section) => renderSection(section, currentPath))}
        </nav>
        <div className="docs-sidebar__footer">
          <a href={repoGitHubUrl} target="_blank" rel="noreferrer">
            <GithubIcon className="docs-inline-icon" />
            GitHub repository
          </a>
        </div>
      </aside>

      <main className="docs-main">
        <div className="docs-content-grid">
          <article className="docs-markdown">
            {content ?? <DocMarkdown content={page.content} />}
            {previous || next ? (
              <nav className="docs-pagination" aria-label="Page navigation">
                {previous ? (
                  <Link href={previous.href} className="docs-pagination__link">
                    <span className="docs-pagination__eyebrow">Previous</span>
                    <span className="docs-pagination__title">{previous.title}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {next ? (
                  <Link href={next.href} className="docs-pagination__link is-next">
                    <span className="docs-pagination__eyebrow">Next</span>
                    <span className="docs-pagination__title">{next.title}</span>
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </article>

          {sidebar !== undefined ? sidebar : defaultSidebar}
        </div>
      </main>
    </div>
  );
}
