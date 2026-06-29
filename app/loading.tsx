import { LoadingState } from "@/components/ui/app-ui";

export default function Loading() {
  return (
    <div className="admin-shell flex min-h-screen items-center justify-center px-4 text-[var(--text-main)]">
      <div className="premium-card w-full max-w-md p-8">
        <p className="section-kicker">Loading</p>
        <h1 className="section-title mt-2">Preparing workspace</h1>
        <p className="section-description mx-auto">
          Seraph Nexus is loading your current view.
        </p>
        <LoadingState label="Loading current view" className="mt-5" />
      </div>
    </div>
  );
}
