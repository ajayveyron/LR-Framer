import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-shell">
      <section className="panel login-card stack">
        <span className="eyebrow">Not Found</span>
        <h1 className="headline">The requested post could not be found.</h1>
        <p className="muted">
          It may have been removed from Framer or the URL is stale.
        </p>
        <Link className="button" href="/">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
