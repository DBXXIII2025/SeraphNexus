import { redirect } from "next/navigation";

type Params = {
  conversationId: string;
};

export default async function BusinessConversationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { conversationId } = await params;
  redirect(`/messages?conversationId=${encodeURIComponent(conversationId)}`);
}
