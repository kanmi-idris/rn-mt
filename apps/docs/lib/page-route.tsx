import { notFound } from "next/navigation";

import { DocsShell } from "../components/docs-shell";
import { getDocBySlug, getDocPageMetadata, toSlugPath } from "./docs";

import type { Metadata } from "next";

function getCanonicalBasePath() {
  const repositoryName =
    process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "rn-mt";
  return process.env.GITHUB_ACTIONS === "true" ? `/${repositoryName}` : "";
}

export function getDocRouteMetadata(slug: string[]): Metadata {
  const page = getDocBySlug(slug);

  if (!page) {
    return {};
  }

  const metadata = getDocPageMetadata(page);
  const basePath = getCanonicalBasePath();

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: `${basePath}/${toSlugPath(metadata.slug)}`,
    },
  };
}

export function renderDocRoute(slug: string[]) {
  const page = getDocBySlug(slug);

  if (!page) {
    notFound();
  }

  return <DocsShell page={getDocPageMetadata(page)} />;
}
