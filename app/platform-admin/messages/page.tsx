import { redirect } from "next/navigation";

type SearchParams = {
  conversation?: string;
  conversationId?: string;
  success?: string;
  error?: string;
};

export default async function LegacyPlatformAdminMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const nextParams = new URLSearchParams();
  const conversationId = String(params?.conversationId || params?.conversation || "").trim();

  if (conversationId) {
    nextParams.set("conversation", conversationId);
  }

  if (params?.success) {
    nextParams.set("success", String(params.success));
  }

  if (params?.error) {
    nextParams.set("error", String(params.error));
  }

  const to = `/admin/messages${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
  console.info("[platform-admin] legacy route redirected", {
    from: "/platform-admin/messages",
    to,
  });
  redirect(to);
}
