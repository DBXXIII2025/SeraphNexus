"use client";

import { useEffect, useState } from "react";
import {
  ActionButton,
  FormActions,
  FormField,
  FormLabel,
  FormShell,
} from "@/components/ui/app-ui";

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
    <form action={action} method="POST" className="mt-5">
      <input type="hidden" name="action" value="update_property" />
      <input type="hidden" name="property_id" value={propertyId} />

      <FormShell>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField>
            <FormLabel htmlFor="rental-listing-name">Listing name</FormLabel>
            <input
              id="rental-listing-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="input-field"
            />
          </FormField>
          <FormField>
            <FormLabel htmlFor="rental-listing-price">Price</FormLabel>
            <input
              id="rental-listing-price"
              name="price"
              type="number"
              step="0.01"
              min="0.01"
              value={listingPrice}
              onChange={(event) => setListingPrice(event.target.value)}
              required
              className="input-field"
            />
          </FormField>
        </div>

        <FormField>
          <FormLabel htmlFor="rental-listing-description">Description</FormLabel>
          <textarea
            id="rental-listing-description"
            name="description"
            value={listingDescription}
            onChange={(event) => setListingDescription(event.target.value)}
            className="input-field min-h-[132px]"
          />
        </FormField>

        <FormActions>
          <ActionButton type="submit" tone="primary">
            Save Listing Details
          </ActionButton>
        </FormActions>
      </FormShell>
    </form>
  );
}
