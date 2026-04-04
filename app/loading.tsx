export default function Loading() {
  return (
    <div className="admin-shell flex min-h-screen items-center justify-center px-4 text-[var(--text-main)]">
      <div className="premium-card w-full max-w-md p-8">
        <div className="loading-state">
          <div className="loading-orb animate-spin-slow" />
          <div>
            <p className="section-kicker">Loading</p>
            <h1 className="section-title">Preparing workspace</h1>
            <p className="section-description mx-auto">
              Seraph Nexus is loading your current view.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
