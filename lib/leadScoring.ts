export function scoreLead({
  message,
  phone,
  email,
}: {
  message: string;
  phone?: string;
  email?: string;
}) {
  let score = 0;
  const text = message.toLowerCase();

  // 🔥 HIGH INTENT
  if (text.includes("asap") || text.includes("urgent") || text.includes("today")) {
    score += 40;
  }

  // 💰 BUYER SIGNALS
  if (text.includes("price") || text.includes("cost") || text.includes("quote")) {
    score += 30;
  }

  // 📅 ACTION SIGNALS
  if (text.includes("book") || text.includes("schedule") || text.includes("appointment")) {
    score += 20;
  }

  // 📞 CONTACT INFO
  if (phone) score += 10;
  if (email) score += 10;

  // 🎯 DETERMINE TEMPERATURE
  let temperature: "hot" | "warm" | "cold" = "cold";

  if (score >= 70) temperature = "hot";
  else if (score >= 40) temperature = "warm";

  return { score, temperature };
}