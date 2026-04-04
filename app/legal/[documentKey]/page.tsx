import { notFound } from "next/navigation";
import { getLegalDocument } from "@/lib/legalDocuments";

type Params = {
  documentKey: string;
};

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { documentKey } = await params;
  const document = getLegalDocument(documentKey);

  if (!document) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--border-soft)] bg-[var(--panel)] p-8 shadow-[0_18px_48px_rgba(81,61,10,0.08)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-soft)]">
          Legal document
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)]">
          {document.title}
        </h1>
        <div className="mt-4 grid gap-2 text-sm text-[var(--text-soft)] md:grid-cols-3">
          <p>document_key: {document.documentKey}</p>
          <p>document_version: {document.documentVersion}</p>
          <p>last_updated: {document.lastUpdated}</p>
        </div>

        <div className="mt-8 space-y-8">
          {document.sections.map((section, index) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold text-[var(--text-strong)]">
                {index + 1}. {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-[var(--text-main)]">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
