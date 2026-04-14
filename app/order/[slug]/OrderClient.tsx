"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MessageBusinessButton from "@/components/MessageBusinessButton";
import PublicBusinessPolicies from "@/components/PublicBusinessPolicies";
import { translate, type LanguageCode } from "@/lib/i18n";

type MenuCategory = {
  id: string;
  name?: string | null;
  description?: string | null;
};

type MenuItem = {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  category_id?: string | null;
  menu_category_id?: string | null;
  is_active?: boolean | null;
};

type MenuOptionGroup = {
  id: string;
  name?: string | null;
  description?: string | null;
};

type MenuOption = {
  id: string;
  name?: string | null;
  price_delta?: number | string | null;
  option_group_id?: string | null;
  menu_option_group_id?: string | null;
};

type MenuItemOptionGroup = {
  id?: string;
  menu_item_id?: string | null;
  item_id?: string | null;
  menu_option_group_id?: string | null;
  option_group_id?: string | null;
};

type MenuPayload = {
  categories: MenuCategory[];
  items: MenuItem[];
  optionGroups: MenuOptionGroup[];
  options: MenuOption[];
  itemOptionGroups: MenuItemOptionGroup[];
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

type CheckoutOrderItem = {
  id: string;
  quantity: number;
};

export default function OrderClient({
  businessId,
  businessName,
  businessDescription,
  businessType,
  language,
  pickupEnabled,
  deliveryEnabled,
}: {
  businessId: string;
  businessName: string;
  businessDescription: string;
  businessType: string;
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
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuPayload>({
    categories: [],
    items: [],
    optionGroups: [],
    options: [],
    itemOptionGroups: [],
  });
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const hasEnabledFulfillmentMode = pickupEnabled || deliveryEnabled;

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );

  useEffect(() => {
    let active = true;

    const loadMenu = async () => {
      setMenuLoading(true);
      setMenuError(null);
      try {
        const res = await fetch(`/api/menu?businessId=${businessId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load menu");
        }
        if (!active) return;
        setMenu({
          categories: Array.isArray(data?.categories) ? data.categories : [],
          items: Array.isArray(data?.items) ? data.items : [],
          optionGroups: Array.isArray(data?.optionGroups)
            ? data.optionGroups
            : [],
          options: Array.isArray(data?.options) ? data.options : [],
          itemOptionGroups: Array.isArray(data?.itemOptionGroups)
            ? data.itemOptionGroups
            : [],
        });
      } catch (err: any) {
        if (!active) return;
        setMenuError(err?.message || "Failed to load menu");
      } finally {
        if (active) {
          setMenuLoading(false);
        }
      }
    };

    if (businessId) {
      loadMenu();
    }

    return () => {
      active = false;
    };
  }, [businessId]);

  useEffect(() => {
    if (fulfillmentType === "pickup" && !pickupEnabled && deliveryEnabled) {
      setFulfillmentType("delivery");
    }
    if (fulfillmentType === "delivery" && !deliveryEnabled && pickupEnabled) {
      setFulfillmentType("pickup");
    }
  }, [deliveryEnabled, fulfillmentType, pickupEnabled]);

  const activeItems = useMemo(
    () => menu.items.filter((item) => item.is_active !== false),
    [menu.items]
  );

  const optionGroupsById = useMemo(() => {
    const map = new Map<string, MenuOptionGroup>();
    menu.optionGroups.forEach((group) => {
      if (group.id) {
        map.set(group.id, group);
      }
    });
    return map;
  }, [menu.optionGroups]);

  const optionsByGroupId = useMemo(() => {
    const map = new Map<string, MenuOption[]>();
    menu.options.forEach((option) => {
      const groupId =
        option.option_group_id ?? option.menu_option_group_id ?? null;
      if (!groupId) return;
      const list = map.get(groupId) || [];
      list.push(option);
      map.set(groupId, list);
    });
    return map;
  }, [menu.options]);

  const itemOptionGroupIds = useMemo(() => {
    const map = new Map<string, string[]>();
    menu.itemOptionGroups.forEach((link) => {
      const itemId = link.menu_item_id ?? link.item_id ?? null;
      const groupId = link.menu_option_group_id ?? link.option_group_id ?? null;
      if (!itemId || !groupId) return;
      const list = map.get(itemId) || [];
      if (!list.includes(groupId)) {
        list.push(groupId);
      }
      map.set(itemId, list);
    });
    return map;
  }, [menu.itemOptionGroups]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    activeItems.forEach((item) => {
      const categoryId = item.category_id ?? item.menu_category_id ?? "uncategorized";
      const key = categoryId || "uncategorized";
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [activeItems]);

  function addToCart(item: MenuItem) {
    const priceNumber = Number(item.price || 0);
    const name = item.name || "Menu item";

    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { id: item.id, name, price: priceNumber, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  async function placeOrder() {
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
    if (!hasEnabledFulfillmentMode) {
      setError("Ordering is not available for this business right now.");
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
    if (cart.length === 0) {
      setError("Add items to your cart to continue");
      return;
    }

    setPlacing(true);
    try {
      const orderItems: CheckoutOrderItem[] = cart.map((item) => ({
        id: item.id,
        quantity: item.qty,
      }));

      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          items: orderItems,
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
      setError(err?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  const renderCategory = (category: MenuCategory) => {
    const items = groupedItems.get(category.id) || [];
    if (items.length === 0) {
      return null;
    }

    return (
      <div key={category.id} className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{category.name || "Menu"}</h2>
          {category.description && (
            <p className="text-sm text-gray-400">{category.description}</p>
          )}
        </div>
        {items.map((item) => {
          const priceNumber = Number(item.price || 0);
          const groupIds = itemOptionGroupIds.get(item.id) || [];
          const groupNames = groupIds
            .map((id) => optionGroupsById.get(id)?.name)
            .filter((name): name is string => Boolean(name));
          const optionCount = groupIds.reduce((sum, groupId) => {
            return sum + (optionsByGroupId.get(groupId)?.length || 0);
          }, 0);

          return (
            <div
              key={item.id}
              className="bg-black/40 border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{item.name || "Menu item"}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-400">{item.description}</p>
                  )}
                </div>
                <div className="text-sm">${priceNumber.toFixed(2)}</div>
              </div>
              {groupNames.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Options: {groupNames.join(", ")}
                  {optionCount > 0 ? ` (${optionCount})` : ""}
                </p>
              )}
              <button
                onClick={() => addToCart(item)}
                className="mt-3 bg-purple-600 px-3 py-1 rounded text-sm hover:bg-purple-500"
              >
                {t("addToCart")}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const uncategorizedItems = groupedItems.get("uncategorized") || [];
  const menuIsEmpty = !menuLoading && !menuError && activeItems.length === 0;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">{businessName}</h1>
              <p className="text-sm text-gray-400">
                Order from the latest menu.
              </p>
            </div>
            <MessageBusinessButton
              businessId={businessId}
              className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-black/30"
            />
          </div>
        </div>

        <PublicBusinessPolicies description={businessDescription} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {menuLoading && (
              <p className="text-sm text-gray-400">Loading menu...</p>
            )}
            {menuError && (
              <p className="text-sm text-red-400">{menuError}</p>
            )}
            {menuIsEmpty && (
              <p className="text-sm text-gray-400">Menu not available.</p>
            )}
            {!menuLoading && !menuError && !menuIsEmpty && (
              <div className="space-y-6">
                {menu.categories.length > 0
                  ? menu.categories.map((category) => renderCategory(category))
                  : null}

                {menu.categories.length > 0 && uncategorizedItems.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold">Other</h2>
                    {uncategorizedItems.map((item) => {
                      const priceNumber = Number(item.price || 0);
                      const groupIds = itemOptionGroupIds.get(item.id) || [];
                      const groupNames = groupIds
                        .map((id) => optionGroupsById.get(id)?.name)
                        .filter((name): name is string => Boolean(name));
                      const optionCount = groupIds.reduce((sum, groupId) => {
                        return sum + (optionsByGroupId.get(groupId)?.length || 0);
                      }, 0);

                      return (
                        <div
                          key={item.id}
                          className="bg-black/40 border border-white/10 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">
                                {item.name || "Menu item"}
                              </h3>
                              {item.description && (
                                <p className="text-sm text-gray-400">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="text-sm">${priceNumber.toFixed(2)}</div>
                          </div>
                          {groupNames.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Options: {groupNames.join(", ")}
                              {optionCount > 0 ? ` (${optionCount})` : ""}
                            </p>
                          )}
                          <button
                            onClick={() => addToCart(item)}
                            className="mt-3 bg-purple-600 px-3 py-1 rounded text-sm hover:bg-purple-500"
                          >
                {t("addToCart")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {menu.categories.length === 0 && (
                  <div className="space-y-3">
                    {activeItems.map((item) => {
                      const priceNumber = Number(item.price || 0);
                      const groupIds = itemOptionGroupIds.get(item.id) || [];
                      const groupNames = groupIds
                        .map((id) => optionGroupsById.get(id)?.name)
                        .filter((name): name is string => Boolean(name));
                      const optionCount = groupIds.reduce((sum, groupId) => {
                        return sum + (optionsByGroupId.get(groupId)?.length || 0);
                      }, 0);

                      return (
                        <div
                          key={item.id}
                          className="bg-black/40 border border-white/10 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">
                                {item.name || "Menu item"}
                              </h3>
                              {item.description && (
                                <p className="text-sm text-gray-400">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="text-sm">${priceNumber.toFixed(2)}</div>
                          </div>
                          {groupNames.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Options: {groupNames.join(", ")}
                              {optionCount > 0 ? ` (${optionCount})` : ""}
                            </p>
                          )}
                          <button
                            onClick={() => addToCart(item)}
                            className="mt-3 bg-purple-600 px-3 py-1 rounded text-sm hover:bg-purple-500"
                          >
                            {t("addToCart")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold">{t("yourOrder")}</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400">{t("cartEmpty")}</p>
            ) : (
              <div className="space-y-3 text-sm">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <div>{item.name}</div>
                      <div className="text-xs text-gray-400">
                        ${item.price.toFixed(2)} each
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          className="px-2 py-1 border border-white/20 rounded"
                          onClick={() => updateQty(item.id, -1)}
                        >
                          -
                        </button>
                        <span>{item.qty}</span>
                        <button
                          className="px-2 py-1 border border-white/20 rounded"
                          onClick={() => updateQty(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>${(item.price * item.qty).toFixed(2)}</div>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                  <span>{t("total")}</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">{t("fulfillment")}</label>
                <div className="flex gap-3">
                  {pickupEnabled ? (
                    <button
                      type="button"
                      onClick={() => setFulfillmentType("pickup")}
                      className={`flex-1 py-2 rounded border ${
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
                      className={`flex-1 py-2 rounded border ${
                        fulfillmentType === "delivery"
                          ? "border-green-500 bg-green-600/20"
                          : "border-white/10 bg-black/30"
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
              </div>
              <input
                placeholder={t("name")}
                className="w-full p-2 rounded bg-black/40 border border-white/10"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                placeholder={t("emailAddress")}
                className="w-full p-2 rounded bg-black/40 border border-white/10"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
              <input
                placeholder={t("phone")}
                className="w-full p-2 rounded bg-black/40 border border-white/10"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              {fulfillmentType === "delivery" && deliveryEnabled && (
                <div className="space-y-2">
                  <input
                    placeholder={t("streetAddress")}
                    className="w-full p-2 rounded bg-black/40 border border-white/10"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                  <input
                    placeholder={t("aptSuiteOptional")}
                    className="w-full p-2 rounded bg-black/40 border border-white/10"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                  />
                  <input
                    placeholder={t("city")}
                    className="w-full p-2 rounded bg-black/40 border border-white/10"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <input
                      placeholder={t("state")}
                      className="w-full p-2 rounded bg-black/40 border border-white/10"
                      value={addressState}
                      onChange={(e) => setAddressState(e.target.value)}
                    />
                    <input
                      placeholder={t("zip")}
                      className="w-full p-2 rounded bg-black/40 border border-white/10"
                      value={addressPostal}
                      onChange={(e) => setAddressPostal(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <textarea
                placeholder="Notes (optional)"
                className="w-full p-2 rounded bg-black/40 border border-white/10 min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={placeOrder}
                disabled={placing || cart.length === 0 || !hasEnabledFulfillmentMode}
                className="w-full bg-green-600 py-2 rounded hover:bg-green-500 disabled:opacity-50"
              >
                {placing ? t("checkoutStarting") : t("proceedToPayment")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
