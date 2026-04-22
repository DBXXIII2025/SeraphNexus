"use client";

import { useEffect, useState } from "react";

type Props = {
  action: string;
  propertyId: string;
  propertyName: string;
  price: number | null;
  description: string | null;
};

export default function PropertyListingEditor({
  action,
  propertyId,
  propertyName,
  price,
  description,
}: Props) {
  const [name, setName] = useState(propertyName);
  const [listingPrice, setListingPrice] = useState(
    price === null || Number.isNaN(price) ? "" : String(price)
  );
  const [listingDescription, setListingDescription] = useState(description || "");

  useEffect(() => {
    setName(propertyName);
    setListingPrice(price === null || Number.isNaN(price) ? "" : String(price));
    setListingDescription(description || "");
  }, [description, price, propertyId, propertyName]);

  return (
    <form action={action} method="POST" className="mt-5 space-y-4">
      <input type="hidden" name="action" value="update_property" />
      <input type="hidden" name="property_id" value={propertyId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Listing name</p>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="input-field"
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Price</p>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0.01"
            value={listingPrice}
            onChange={(event) => setListingPrice(event.target.value)}
            required
            className="input-field"
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Description</p>
        <textarea
          name="description"
          value={listingDescription}
          onChange={(event) => setListingDescription(event.target.value)}
          className="input-field min-h-[132px]"
        />
      </div>

      <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
        Save Listing Details
      </button>
    </form>
  );
}
