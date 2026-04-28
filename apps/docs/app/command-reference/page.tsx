import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["command-reference"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function CommandReferencePage() {
  return renderDocRoute(slug);
}
