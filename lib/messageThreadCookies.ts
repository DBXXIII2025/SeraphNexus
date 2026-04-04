export function getGuestConversationCookieName(businessId: string) {
  return `guest_message_thread_${businessId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
