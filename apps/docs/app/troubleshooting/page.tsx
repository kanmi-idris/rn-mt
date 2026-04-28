import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["troubleshooting"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function TroubleshootingPage() {
  return renderDocRoute(slug);
}
