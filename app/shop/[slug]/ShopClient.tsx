"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import BusinessProfileShell from "@/components/BusinessProfileShell";
import PromoCodeField from "@/components/checkout/PromoCodeField";
import type { BusinessPageImage, BusinessPageTheme } from "@/lib/businessPageCustomization";
import type { AppliedDiscount } from "@/lib/discountCodes";
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
  description?: string | null;
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
  logoUrl,
  pageTheme,
  galleryImages,
  platformBrand,
  profileContact,
}: {
  businessId: string;
  businessName: string;
  businessDescription: string;
  businessType: string;
  items: CatalogItem[];
  language: LanguageCode;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  logoUrl: string | null;
  pageTheme: BusinessPageTheme;
  galleryImages: BusinessPageImage[];
  platformBrand?: {
    siteName: string;
    logoUrl?: string | null;
  };
  profileContact?: {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    serviceArea?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  };
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
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const subtotalCents = Math.round(total * 100);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const hasEnabledFulfillmentMode = pickupEnabled || deliveryEnabled;

  useEffect(() => {
    if (fulfillmentType === "pickup" && !pickupEnabled && deliveryEnabled) {
      setFulfillmentType("delivery");
    }
    if (fulfillmentType === "delivery" && !deliveryEnabled && pickupEnabled) {
      setFulfillmentType("pickup");
    }
  }, [deliveryEnabled, fulfillmentType, pickupEnabled]);

  function addToCart(item: CatalogItem) {
    console.info("[shop/client] selected product payload", {
      businessId,
      itemId: item.id,
      hasDescription: Boolean(item.description?.trim()),
      currentCartCount: cart.length,
    });

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
          description: item.description || null,
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
    if (!hasEnabledFulfillmentMode) {
      setError("Ordering is not available for this business right now.");
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
          type: "product",
          business_id: businessId,
          item_id: cart[0]?.id,
          promo_code: appliedDiscount?.code,
          metadata: {
            customer: {
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
            },
            fulfillment_type: fulfillmentType,
            address: {
              line1: addressLine1,
              line2: addressLine2,
              city: addressCity,
              state: addressState,
              postalCode: addressPostal,
            },
            notes,
            items: cart.map((item) => ({
              item_id: item.id,
              quantity: item.quantity,
            })),
          },
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
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      <div className="px-3 py-5 sm:py-6">
        <BusinessProfileShell
          businessName={businessName}
          businessDescription={businessDescription}
          businessType={businessType}
          logoUrl={logoUrl}
          images={galleryImages}
          theme={pageTheme}
          platformBrand={platformBrand}
          contact={profileContact}
          action={
            <MessageBusinessButton
              businessId={businessId}
              className="btn-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
            />
          }
        />
      </div>
      <div className="bg-[var(--page-bg)]">
      <div className="mx-auto max-w-6xl space-y-6 p-6 text-[var(--text-main)]">
        <p className="text-sm text-[var(--text-soft)]">Browse the live storefront for this business.</p>
        <div className="grid gap-6 md:grid-cols-[1.3fr,0.7fr]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-sm text-[var(--text-soft)]">
                No items have been published yet.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]"
                >
                  <div className="aspect-[4/3] bg-[var(--surface-muted)]">
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
                          <p className="mt-1 text-sm text-[var(--text-soft)]">
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
                      className="btn-primary inline-flex px-3 py-2 text-sm font-medium"
                    >
                      {t("addToCart")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold">{t("yourCart")}</h2>
            <div className="mt-4 space-y-3 text-sm">
              {cart.length === 0 ? (
                <p className="text-[var(--text-soft)]">{t("cartEmpty")}</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4">
                    <div>
                      <p>{item.name}</p>
                      {item.description ? (
                        <p className="mt-1 text-xs leading-5 text-[var(--text-soft)]">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="text-xs text-[var(--text-soft)]">
                        ${item.price.toFixed(2)} each
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-[var(--border-strong)] px-2 py-1"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="rounded border border-[var(--border-strong)] px-2 py-1"
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

            <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
              <div className="flex justify-between text-sm font-semibold">
                <span>{t("total")}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4">
              <PromoCodeField
                businessId={businessId}
                checkoutType="product"
                subtotalCents={subtotalCents}
                disabled={cart.length === 0}
                onAppliedChange={setAppliedDiscount}
              />
            </div>

            <div className="mt-5 space-y-3">
              <input
                placeholder={t("name")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
              />
              <input
                placeholder={t("emailAddress")}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
              />
              <input
                placeholder={t("phone")}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
              />
              <div className="flex gap-3">
                {pickupEnabled ? (
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("pickup")}
                    className={`flex-1 rounded border py-2 ${
                      fulfillmentType === "pickup"
                        ? "border-[var(--success)] bg-[var(--success-bg)]"
                        : "border-[var(--border-soft)] bg-[var(--surface-muted)]"
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
                        ? "border-[var(--success)] bg-[var(--success-bg)]"
                        : "border-[var(--border-soft)] bg-[var(--surface-muted)]"
                    }`}
                  >
                    {t("delivery")}
                  </button>
                ) : null}
              </div>
              {!hasEnabledFulfillmentMode ? (
                <p className="text-xs text-red-300">
                  Ordering is not available for this business right now.
                </p>
              ) : null}

              {fulfillmentType === "delivery" && deliveryEnabled && (
                <div className="space-y-2">
                  <input
                    placeholder={t("streetAddress")}
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
                  />
                  <input
                    placeholder={t("aptSuiteOptional")}
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
                  />
                  <input
                    placeholder={t("city")}
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
                  />
                  <div className="flex gap-2">
                    <input
                      placeholder={t("state")}
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value)}
                      className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
                    />
                    <input
                      placeholder={t("zip")}
                      value={addressPostal}
                      onChange={(e) => setAddressPostal(e.target.value)}
                      className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
                    />
                  </div>
                </div>
              )}

              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[90px] w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0 || !hasEnabledFulfillmentMode}
                className="btn-primary inline-flex px-4 py-2 font-medium disabled:opacity-60"
              >
                {loading ? t("checkoutStarting") : t("proceedToPayment")}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
