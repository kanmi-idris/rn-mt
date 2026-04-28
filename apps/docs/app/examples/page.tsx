import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["examples"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function ExamplesPage() {
  return renderDocRoute(slug);
}
