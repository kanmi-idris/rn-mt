import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["contributing"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function ContributingPage() {
  return renderDocRoute(slug);
}
