type SuccessPageProps = {
  searchParams?: {
    orderId?: string;
  };
};

export default function OrderSuccessPage({ searchParams }: SuccessPageProps) {
  const orderId = searchParams?.orderId || "pending";

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl font-semibold">Order received</h1>
        <p className="text-gray-300">
          Thanks for your order. We&apos;re preparing it now.
        </p>
        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
          <div className="text-sm text-gray-400">Order ID</div>
          <div className="text-lg font-semibold">{orderId}</div>
        </div>
      </div>
    </div>
  );
}
