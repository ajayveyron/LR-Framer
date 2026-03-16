export default function DashboardLayout({
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="login-shell">
      <section className="panel login-card stack">
        <span className="eyebrow">Frontend Disabled</span>
        <h1 className="headline">The dashboard is temporarily offline.</h1>
        <p className="muted">
          The frontend editor has been removed for now. Backend routes under{" "}
          <span className="mono">/api</span> and the Notion-to-Framer bridge remain
          available.
        </p>
      </section>
    </main>
  );
}
