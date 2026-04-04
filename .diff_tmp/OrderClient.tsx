"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

const MENU: MenuItem[] = [
  {
    id: "margherita",
    name: "Margherita Pizza",
    description: "Tomato, mozzarella, basil.",
    price: 14,
  },
  {
    id: "pepperoni",
    name: "Pepperoni Pizza",
    description: "Classic pepperoni with mozzarella.",
    price: 16,
  },
  {
    id: "veggie",
    name: "Garden Veggie Pizza",
    description: "Bell peppers, onions, olives, mushrooms.",
    price: 15,
  },
  {
    id: "caesar",
    name: "Caesar Salad",
    description: "Romaine, parmesan, croutons.",
    price: 9,
  },
];

export default function OrderClient({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
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
    setPlacing(true);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerName,
          customerPhone,
          items: cart,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to place order");
      }
      const orderId = data?.orderId || "";
      router.push(`/order/success?orderId=${encodeURIComponent(orderId)}`);
    } catch (err: any) {
      setError(err?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">{businessName}</h1>
          <p className="text-sm text-gray-400">Pizza menu coming soon.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {MENU.map((item) => (
              <div
                key={item.id}
                className="bg-black/40 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                  <div className="text-sm">${item.price.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => addToCart(item)}
                  className="mt-3 bg-purple-600 px-3 py-1 rounded text-sm hover:bg-purple-500"
                >
                  Add to cart
                </button>
              </div>
            ))}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold">Your Order</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400">Cart is empty.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <div>{item.name}</div>
                      <div className="text-xs text-gray-400">
                        ${item.price.toFixed(2)} each
                      </div>
                      <div className="mt-1 flex items-center gap-2">
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
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <input
                placeholder="Your name"
                className="w-full p-2 rounded bg-black/40 border border-white/10"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                placeholder="Phone number"
                className="w-full p-2 rounded bg-black/40 border border-white/10"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={placeOrder}
                disabled={placing || cart.length === 0}
                className="w-full bg-green-600 py-2 rounded hover:bg-green-500 disabled:opacity-50"
              >
                {placing ? "Placing..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
