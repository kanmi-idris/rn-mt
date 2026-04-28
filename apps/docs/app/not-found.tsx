import Link from "next/link";

import { AlertIcon, RocketIcon } from "../components/icons";

export default function NotFoundPage() {
  return (
    <main className="docs-not-found">
      <div className="docs-not-found__card">
        <p className="docs-eyebrow">
          <AlertIcon className="docs-section-icon" />
          <span>404</span>
        </p>
        <h1>Page not found</h1>
        <p>
          This docs route does not map to a published developer docs page.
        </p>
        <Link href="/introduction" className="docs-button docs-button--primary">
          <RocketIcon className="docs-button__icon" />
          Go to introduction
        </Link>
      </div>
    </main>
  );
}
