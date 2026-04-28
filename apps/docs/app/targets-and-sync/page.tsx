import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["targets-and-sync"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function TargetsAndSyncPage() {
  return renderDocRoute(slug);
}
