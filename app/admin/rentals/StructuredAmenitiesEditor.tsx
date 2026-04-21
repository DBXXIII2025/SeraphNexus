"use client";

import { useEffect, useMemo, useState } from "react";
import StructuredIcon from "@/components/icons/StructuredIcon";
import {
  PROPERTY_AMENITY_DEFINITIONS,
  type PropertyAmenityData,
  formatAmenityCount,
} from "@/lib/propertyAmenities";

type Props = {
  action: string;
  propertyId: string;
  propertyName: string;
  price: number | null;
  description: string | null;
  initialAmenities: PropertyAmenityData;
};

export default function StructuredAmenitiesEditor({
  action,
  propertyId,
  propertyName,
  price,
  description,
  initialAmenities,
}: Props) {
  const [name, setName] = useState(propertyName);
  const [listingPrice, setListingPrice] = useState(
    price === null || Number.isNaN(price) ? "" : String(price)
  );
  const [listingDescription, setListingDescription] = useState(description || "");
  const [amenities, setAmenities] = useState(initialAmenities);

  useEffect(() => {
    setName(propertyName);
    setListingPrice(price === null || Number.isNaN(price) ? "" : String(price));
    setListingDescription(description || "");
    setAmenities(initialAmenities);
  }, [description, initialAmenities, price, propertyId, propertyName]);

  const countHighlights = useMemo(
    () =>
      [
        { label: formatAmenityCount(amenities.bedrooms, "bedroom"), icon: "bed" as const },
        { label: formatAmenityCount(amenities.bathrooms, "bathroom"), icon: "bath" as const },
      ].filter((item) => Boolean(item.label)),
    [amenities.bathrooms, amenities.bedrooms]
  );

  return (
    <form
      action={action}
      method="POST"
      className="mt-5 space-y-6"
      onSubmit={() => {
        console.log("[admin/rentals/form] amenities payload before save", {
          propertyId,
          amenityData: amenities,
        });
      }}
    >
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
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Bedrooms</p>
          <select
            name="bedrooms"
            value={amenities.bedrooms === null ? "" : String(amenities.bedrooms)}
            onChange={(event) =>
              setAmenities((current) => ({
                ...current,
                bedrooms: event.target.value ? Number(event.target.value) : null,
              }))
            }
            className="input-field"
          >
            <option value="">Not set</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Bathrooms</p>
          <select
            name="bathrooms"
            value={amenities.bathrooms === null ? "" : String(amenities.bathrooms)}
            onChange={(event) =>
              setAmenities((current) => ({
                ...current,
                bathrooms: event.target.value ? Number(event.target.value) : null,
              }))
            }
            className="input-field"
          >
            <option value="">Not set</option>
            {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Description</p>
          <textarea
            name="description"
            value={listingDescription}
            onChange={(event) => setListingDescription(event.target.value)}
            className="input-field min-h-[132px]"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-5">
        <div className="flex flex-wrap gap-3">
          {countHighlights.length > 0 ? (
            countHighlights.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-sm font-medium text-[var(--accent-soft)]"
              >
                <StructuredIcon name={item.icon} className="h-4 w-4" />
                {item.label}
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--text-soft)]">
              Bedroom and bathroom counts are optional, but they improve public scanability.
            </span>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--text-soft)]">Amenity checklist</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PROPERTY_AMENITY_DEFINITIONS.map((amenity) => (
            <label
              key={amenity.key}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-main)]"
            >
              <input
                type="checkbox"
                name={amenity.key}
                checked={amenities[amenity.key]}
                onChange={(event) =>
                  setAmenities((current) => ({
                    ...current,
                    [amenity.key]: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              <StructuredIcon name={amenity.icon} className="h-4 w-4 text-[var(--accent-soft)]" />
              <span>{amenity.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
        Save Amenities
      </button>
    </form>
  );
}
