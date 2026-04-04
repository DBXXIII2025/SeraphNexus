export default function PublicBusinessPolicies({
  description,
}: {
  description?: string | null;
}) {
  if (!description) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-6">
      <h2 className="text-lg font-semibold text-[var(--text-strong)]">
        Business information
      </h2>
      <div className="mt-4 space-y-4 text-sm text-[var(--text-soft)]">
        {description ? (
          <div>
            <p className="font-medium text-[var(--text-strong)]">Description</p>
            <p className="mt-1 whitespace-pre-wrap">{description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
