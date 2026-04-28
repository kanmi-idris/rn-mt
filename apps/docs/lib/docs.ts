import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

export const repoGitHubUrl = "https://github.com/kanmi-idris/rn-mt";
export const repoIssuesNewUrl = `${repoGitHubUrl}/issues/new`;
const repoEditBaseUrl = `${repoGitHubUrl}/edit/main`;
const repoSourceBaseUrl = `${repoGitHubUrl}/blob/main`;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../..");

export type DocNavItem = {
  title: string;
  slug: string[];
  filePath: string;
};

export type DocSection = {
  title: string;
  items: DocNavItem[];
};

export type DocHeading = {
  depth: 2 | 3;
  id: string;
  text: string;
};

export type DocPage = DocNavItem & {
  content: string;
  description: string;
  editUrl: string;
  sourceUrl: string;
  headings: DocHeading[];
};

export type DocPageLink = {
  title: string;
  href: string;
};

export type DocPageMetadata = DocPage;

export const docsNavigation: DocSection[] = [
  {
    title: "Start Here",
    items: [
      {
        title: "Introduction",
        slug: ["introduction"],
        filePath: "docs/developer/introduction.md",
      },
      {
        title: "Get Started",
        slug: ["get-started"],
        filePath: "docs/developer/get-started.md",
      },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        title: "Convert an App",
        slug: ["convert-an-app"],
        filePath: "docs/developer/convert-an-app.md",
      },
      {
        title: "Targets & Sync",
        slug: ["targets-and-sync"],
        filePath: "docs/developer/targets-and-sync.md",
      },
      {
        title: "Workflow Hooks",
        slug: ["workflow-hooks"],
        filePath: "docs/developer/workflow-hooks.md",
      },
      {
        title: "Agent Skill",
        slug: ["agent-skill"],
        filePath: "docs/developer/agent-skill.md",
      },
      {
        title: "Command Reference",
        slug: ["command-reference"],
        filePath: "docs/developer/command-reference.md",
      },
    ],
  },
  {
    title: "Project",
    items: [
      {
        title: "Examples",
        slug: ["examples"],
        filePath: "docs/developer/examples.md",
      },
      {
        title: "Architecture",
        slug: ["architecture"],
        filePath: "docs/developer/architecture.md",
      },
      {
        title: "Contributing",
        slug: ["contributing"],
        filePath: "docs/developer/contributing.md",
      },
      {
        title: "Troubleshooting",
        slug: ["troubleshooting"],
        filePath: "docs/developer/troubleshooting.md",
      },
    ],
  },
];

const docsPages = docsNavigation.flatMap((section) => section.items);

export function toSlugPath(slug: string[]) {
  return slug.join("/");
}

export function toSlugId(value: string) {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function stripLeadingTitle(markdown: string) {
  return markdown.replace(/^#\s+.+\n+/, "");
}

function readDocContent(filePath: string) {
  const candidateRoots = [
    repoRoot,
    process.cwd(),
    path.resolve(process.cwd(), "../.."),
  ];
  const absolutePath = candidateRoots
    .map((root) => path.join(root, filePath))
    .find((candidate) => existsSync(candidate));

  if (!absolutePath) {
    throw new Error(
      `Doc file not found for "${filePath}". Checked: ${candidateRoots
        .map((root) => path.join(root, filePath))
        .join(", ")}`,
    );
  }

  const rawContents = readFileSync(absolutePath, "utf8");
  return matter(rawContents);
}

function stripMarkdownFormatting(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function extractTitle(markdown: string, fallbackTitle: string) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]
    ? stripMarkdownFormatting(titleMatch[1])
    : fallbackTitle;
}

function extractDescription(markdown: string) {
  const lines = markdown.split("\n");
  let seenTitle = false;

  for (const line of lines) {
    if (!seenTitle) {
      if (line.startsWith("# ")) {
        seenTitle = true;
      }
      continue;
    }

    const trimmed = line.trim();

    if (
      trimmed.length === 0 ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      /^\d+\.\s/.test(trimmed)
    ) {
      continue;
    }

    return stripMarkdownFormatting(trimmed);
  }

  return "Detailed documentation for this rn-mt page.";
}

function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = /^(##|###)\s+(.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const rawHeading = match[2];
    if (!rawHeading) {
      continue;
    }

    const text = stripMarkdownFormatting(rawHeading);
    if (!text) {
      continue;
    }

    const depthToken = match[1];
    if (!depthToken) {
      continue;
    }

    const depth = depthToken.length as 2 | 3;
    headings.push({
      depth,
      id: toSlugId(text),
      text,
    });
  }

  return headings;
}

export function getAllDocSlugs() {
  return docsPages.map((page) => page.slug);
}

export function getDocBySlug(slug: string[]) {
  const requestedPath = toSlugPath(slug);
  return docsPages.find((page) => toSlugPath(page.slug) === requestedPath);
}

export function getDocPageMetadata(page: DocNavItem): DocPageMetadata {
  const { content } = readDocContent(page.filePath);
  const title = extractTitle(content, page.title);
  const description = extractDescription(content);
  const headings = extractHeadings(content);

  return {
    ...page,
    content,
    description,
    headings,
    editUrl: `${repoEditBaseUrl}/${page.filePath}`,
    sourceUrl: `${repoSourceBaseUrl}/${page.filePath}`,
    title,
  };
}

export function getAdjacentDocLinks(slug: string[]) {
  const currentPath = toSlugPath(slug);
  const currentIndex = docsPages.findIndex(
    (page) => toSlugPath(page.slug) === currentPath,
  );

  if (currentIndex < 0) {
    return {
      previous: null,
      next: null,
    };
  }

  const previousPage = docsPages[currentIndex - 1] ?? null;
  const nextPage = docsPages[currentIndex + 1] ?? null;

  return {
    previous: previousPage
      ? {
          title: previousPage.title,
          href: `/${toSlugPath(previousPage.slug)}`,
        }
      : null,
    next: nextPage
      ? {
          title: nextPage.title,
          href: `/${toSlugPath(nextPage.slug)}`,
        }
      : null,
  };
}
