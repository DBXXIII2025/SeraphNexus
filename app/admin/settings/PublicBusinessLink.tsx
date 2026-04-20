"use client";

type PublicBusinessLinkProps = {
  slug?: string | null;
  isPublished?: boolean | null;
};

const PUBLIC_BASE_URL = "https://seraph-nexus.vercel.app";

export default function PublicBusinessLink({
  slug,
  isPublished,
}: PublicBusinessLinkProps) {
  const publicUrl = slug ? `${PUBLIC_BASE_URL}/b/${slug}` : "";

  async function copyLink() {
    if (!publicUrl) {
      return;
    }

    await navigator.clipboard.writeText(publicUrl);
  }

  return (
    <section className="surface-card p-6">
      <div className="section-header-copy">
        <p className="section-kicker">Public Business Link</p>
        <h2 className="section-title">Public share link</h2>
        <p className="section-description">
          Share the canonical public business page after this business is published.
        </p>
      </div>

      {!isPublished || !slug ? (
        <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          Publish your business to unlock your public share link
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-strong)]">
            {publicUrl}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="btn-secondary px-4 py-2 text-sm font-medium"
            >
              Copy
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary px-4 py-2 text-sm font-medium"
            >
              Open
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
