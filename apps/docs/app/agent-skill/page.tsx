import { getDocRouteMetadata, renderDocRoute } from "../../lib/page-route";

import type { Metadata } from "next";

const slug = ["agent-skill"];

export function generateMetadata(): Metadata {
  return getDocRouteMetadata(slug);
}

export default function AgentSkillPage() {
  return renderDocRoute(slug);
}
