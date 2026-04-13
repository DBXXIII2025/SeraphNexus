"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import PublicBusinessPolicies from "@/components/PublicBusinessPolicies";
import { translate, type LanguageCode } from "@/lib/i18n";

type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export default function ShopClient({
  businessId,
  businessName,
  businessDescription,
  businessType,
  items,
  language,
  pickupEnabled,
  deliveryEnabled,
}: {
  businessId: string;
  businessName: string;
  businessDescription: string;
  businessType: string;
  items: CatalogItem[];
  language: LanguageCode;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">(
    pickupEnabled ? "pickup" : "delivery"
  );
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  function addToCart(item: CatalogItem) {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleCheckout() {
    setError(null);

    if (!customerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!customerPhone.trim()) {
      setError("Please enter your phone number");
      return;
    }
    if (!customerEmail.trim()) {
      setError("Please enter your email");
      return;
    }

    if (cart.length === 0) {
      setError("Add items to your cart to continue");
      return;
    }

    if (fulfillmentType === "pickup" && !pickupEnabled) {
      setError("Pickup is not available for this business.");
      return;
    }

    if (fulfillmentType === "delivery" && !deliveryEnabled) {
      setError("Delivery is not available for this business.");
      return;
    }

    if (fulfillmentType === "delivery") {
      if (
        !addressLine1.trim() ||
        !addressCity.trim() ||
        !addressState.trim() ||
        !addressPostal.trim()
      ) {
        setError(t("deliveryAddressRequired"));
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intentType: "order",
          businessId,
          businessType,
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
          },
          fulfillmentType,
          address: {
            line1: addressLine1,
            line2: addressLine2,
            city: addressCity,
            state: addressState,
            postalCode: addressPostal,
          },
          notes,
          orderItems: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.sessionId) {
        router.push(`/order/success?session_id=${encodeURIComponent(data.sessionId)}`);
        return;
      }

      throw new Error("Stripe checkout URL was not returned");
    } catch (err: any) {
      setError(err?.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">{businessName}</h1>
              <p className="text-sm text-gray-400">
                Browse the live storefront for this business.
              </p>
            </div>
            <MessageBusinessButton
              businessId={businessId}
              className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-black/30"
            />
          </div>
        </div>

        <PublicBusinessPolicies description={businessDescription} />

        <div className="grid gap-6 md:grid-cols-[1.3fr,0.7fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-6 text-sm text-gray-400">
                No items have been published yet.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70"
                >
                  <div className="aspect-[4/3] bg-black/40">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="mt-1 text-sm text-gray-400">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-semibold">
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium hover:bg-green-500"
                    >
                      {t("addToCart")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-semibold">{t("yourCart")}</h2>
            <div className="mt-4 space-y-3 text-sm">
              {cart.length === 0 ? (
                <p className="text-gray-400">{t("cartEmpty")}</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4">
                    <div>
                      <p>{item.name}</p>
                      <p className="text-xs text-gray-400">
                        ${item.price.toFixed(2)} each
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-white/20 px-2 py-1"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="rounded border border-white/20 px-2 py-1"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p>${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex justify-between text-sm font-semibold">
                <span>{t("total")}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <input
                placeholder={t("name")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2"
              />
              <input
                placeholder={t("emailAddress")}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2"
              />
              <input
                placeholder={t("phone")}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2"
              />
              <div className="flex gap-3">
                {pickupEnabled ? (
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("pickup")}
                    className={`flex-1 rounded border py-2 ${
                      fulfillmentType === "pickup"
                        ? "border-green-500 bg-green-600/20"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    {t("pickup")}
                  </button>
                ) : null}
                {deliveryEnabled ? (
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("delivery")}
                    className={`flex-1 rounded border py-2 ${
                      fulfillmentType === "delivery"
                        ? "border-green-500 bg-green-600/20"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    {t("delivery")}
                  </button>
                ) : null}
              </div>

              {fulfillmentType === "delivery" && (
                <div className="space-y-2">
                  <input
                    placeholder={t("streetAddress")}
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/40 p-2"
                  />
                  <input
                    placeholder={t("aptSuiteOptional")}
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/40 p-2"
                  />
                  <input
                    placeholder={t("city")}
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/40 p-2"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder={t("state")}
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-black/40 p-2"
                    />
                    <input
                      placeholder={t("zip")}
                      value={addressPostal}
                      onChange={(e) => setAddressPostal(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-black/40 p-2"
                    />
                  </div>
                </div>
              )}

              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[90px] w-full rounded-md border border-white/10 bg-black/40 p-2"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
                className="w-full rounded-md bg-green-600 px-4 py-2 font-medium hover:bg-green-500 disabled:opacity-60"
              >
                {loading ? t("checkoutStarting") : t("proceedToPayment")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
