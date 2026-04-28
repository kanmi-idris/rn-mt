import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["workflow-hooks"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function WorkflowHooksPage() {
  return renderDocRoute(slug);
}
