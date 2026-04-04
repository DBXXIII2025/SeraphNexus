export function matchLeadToBusiness({
  message,
  services,
}: {
  message: string;
  services: string[];
}) {
  const text = message.toLowerCase();

  return services.some((service) =>
    text.includes(service.toLowerCase())
  );
}