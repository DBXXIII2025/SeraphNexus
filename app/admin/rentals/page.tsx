import Link from "next/link";
import { getTenantQuickstart } from "@/lib/tenantQuickstart";
import RentalsCalendarPanel from "@/components/admin/RentalsCalendarPanel";
import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isRentalBusinessType } from "@/lib/businessModules";
import {
  formatReservationRange,
  getBookingDisplayRange,
  getReservationGuestLabel,
  isActiveRentalBooking,
} from "@/lib/rentalAvailability";
import {
  formatAdminStatusLabel,
  getAdminActionButtonClass,
  getAdminStatusBadgeClass,
} from "@/lib/adminStatus";
import type { Database } from "@/types/database";
import { applyVisibleFilter } from "@/lib/transactionVisibility";
import { createAdminTranslator } from "@/lib/adminI18n";
import {
  PROPERTY_AMENITY_DEFINITIONS,
  formatAmenityCount,
  normalizePropertyAmenityData,
} from "@/lib/propertyAmenities";
import StructuredIcon from "@/components/icons/StructuredIcon";

type PropertyRow = Database["public"]["Tables"]["property"]["Row"];
type PropertyContentRow = Pick<
  Database["public"]["Tables"]["property_content"]["Row"],
  "property_id" | "title" | "description"
>;
type ReservationRow = Database["public"]["Tables"]["rental_reservations"]["Row"];
type BlockRow = Database["public"]["Tables"]["rental_availability_blocks"]["Row"];
type ConversationLookupRow = Pick<
  Database["public"]["Tables"]["conversations"]["Row"],
  "id" | "booking_id"
>;
type PropertyListItem = PropertyRow & {
  description?: string | null;
  amenity_data?: Database["public"]["Tables"]["property"]["Row"]["amenity_data"];
};

type SearchParams = {
  error?: string;
  success?: string;
  warning?: string;
  property?: string;
  message?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  "no-active-business": "Select a rental or property business before saving a listing.",
  "invalid-business-type": "The active business is not a rental or property business.",
  "invalid-listing": "Enter a listing name and a valid price before saving.",
  "listing-save-failed": "The listing could not be saved. Check the server logs for details.",
  "listing-description-save-failed":
    "The listing description could not be saved. The listing data is still available, but description content needs attention.",
  "invalid-block": "Choose a valid listing and a valid date range before blocking dates.",
  "listing-not-found": "The selected listing could not be found for the active business.",
  "block-save-failed": "The blocked dates could not be saved.",
  "invalid-unblock": "The blocked date entry could not be identified.",
  "unblock-failed": "The blocked dates could not be removed.",
  "unknown-action": "The requested rental action was not recognized.",
  unexpected: "An unexpected rental management error occurred.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  "listing-saved": "Listing saved successfully.",
  "dates-blocked": "Dates blocked successfully.",
  "dates-unblocked": "Blocked dates removed successfully.",
};

function getReservationActions(status: string | null | undefined) {
  if (status === "completed" || status === "cancelled") {
    return [];
  }

  if (status === "confirmed") {
    return [
      {
        label: "Mark stay completed",
        status: "completed",
        className: getAdminActionButtonClass("warning"),
      },
      {
        label: "Cancel reservation",
        status: "cancelled",
        className: getAdminActionButtonClass("danger"),
      },
    ];
  }

  return [
    {
      label: "Approve reservation",
      status: "confirmed",
      className: getAdminActionButtonClass("success"),
    },
    {
      label: "Cancel reservation",
      status: "cancelled",
      className: getAdminActionButtonClass("danger"),
    },
  ];
}

export default async function AdminRentalsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const selectedPropertyId = String(params?.property || "").trim();
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return <div className="text-[var(--text-main)]">{createAdminTranslator(null)("noActiveBusiness")}</div>;
  }

  const t = createAdminTranslator(business.language);

  if (!isRentalBusinessType(business.business_type)) {
    return (
      <div className="surface-card p-6 text-[var(--text-main)]">
        {t("inventory")} and {t("reservations").toLowerCase()} calendars are only available for rental
        and property businesses.
      </div>
    );
  }

  const [
    { data: properties },
    { data: propertyContent },
    { data: reservations },
    { data: blocks },
    { data: conversations },
  ] = await Promise.all([
    supabase
      .from("property")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("property_content")
      .select("property_id, title, description")
      .eq("business_id", business.id),
    applyVisibleFilter(
      supabase
        .from("rental_reservations")
        .select("*")
        .eq("business_id", business.id)
        .order("check_in_date", { ascending: true })
    ),
    supabase
      .from("rental_availability_blocks")
      .select("*")
      .eq("business_id", business.id)
      .order("start_date", { ascending: true }),
    supabase
      .from("conversations")
      .select("id, booking_id")
      .eq("business_id", business.id),
  ]);

  console.log("[admin/rentals/page] listings loaded", {
    businessId: business.id,
    businessType: business.business_type || null,
    propertyCount: properties?.length || 0,
    propertyContentCount: propertyContent?.length || 0,
    blockCount: blocks?.length || 0,
    reservationCount: reservations?.length || 0,
    activeReservationCount:
      reservations?.filter((reservation) => isActiveRentalBooking(reservation)).length || 0,
    paidReservationCount:
      reservations?.filter(
        (reservation) =>
          reservation.payment_status === "paid" || reservation.status === "confirmed"
      ).length || 0,
    pendingReservationCount:
      reservations?.filter(
        (reservation) =>
          reservation.status !== "confirmed" &&
          reservation.status !== "cancelled" &&
          reservation.payment_status !== "paid"
      ).length || 0,
  });

  const propertyRows: PropertyRow[] = properties || [];
  const propertyContentRows: PropertyContentRow[] = (propertyContent || []).map((content) => ({
    property_id: content.property_id,
    title: content.title,
    description: content.description,
  }));
  const reservationRows: ReservationRow[] = reservations || [];
  const blockRows: BlockRow[] = blocks || [];
  const conversationRows: ConversationLookupRow[] = (conversations || []).map((row) => ({
    id: row.id,
    booking_id: row.booking_id,
  }));
  const activeReservationRows = reservationRows.filter((reservation) =>
    isActiveRentalBooking(reservation)
  );

  const propertyContentById = new Map(
    propertyContentRows.map((content) => [
      String(content.property_id),
      {
        title: content.title || null,
        description: content.description || null,
      },
    ])
  );

  const propertyList: PropertyListItem[] = propertyRows.map((property) => {
    const content = propertyContentById.get(String(property.id));

    return {
      ...property,
      name: property.name || content?.title || "Listing",
      description: property.description ?? content?.description ?? null,
    };
  });

  const autoSelectedPropertyId =
    selectedPropertyId || (propertyList.length === 1 ? String(propertyList[0].id) : "");
  const selectedProperty =
    propertyList.find((property) => String(property.id) === autoSelectedPropertyId) || null;
  const selectedPropertyAmenities = normalizePropertyAmenityData(selectedProperty?.amenity_data);
  const selectedPropertyCountHighlights = [
    {
      label: formatAmenityCount(selectedPropertyAmenities.bedrooms, "bedroom"),
      icon: "bed" as const,
    },
    {
      label: formatAmenityCount(selectedPropertyAmenities.bathrooms, "bathroom"),
      icon: "bath" as const,
    },
  ].filter((item) => Boolean(item.label));
  const visibleBlocks = autoSelectedPropertyId
    ? blockRows.filter((block) => String(block.property_id) === autoSelectedPropertyId)
    : blockRows;
  const visibleReservations = autoSelectedPropertyId
    ? activeReservationRows.filter(
        (reservation) => String(reservation.property_id) === autoSelectedPropertyId
      )
    : activeReservationRows;

  const propertyNameById = new Map(
    propertyList.map((property) => [String(property.id), property.name || "Listing"])
  );
  const conversationIdByBookingId = new Map(
    conversationRows.map((row) => [String(row.booking_id || ""), String(row.id)])
  );

  const errorMessage = params?.error ? ERROR_MESSAGES[String(params.error)] : null;
  const successMessage = params?.success ? SUCCESS_MESSAGES[String(params.success)] : null;
  const warningMessage = params?.warning ? ERROR_MESSAGES[String(params.warning)] : null;
  const errorDetail = String(params?.message || "").trim();

  const totalRevenue = visibleReservations.reduce(
    (sum, reservation) => sum + Number(reservation.amount_total || 0),
    0
  );
  const quickstart = getTenantQuickstart(business.business_type);

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      <section className="premium-card p-6 lg:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.5fr,0.95fr]">
          <div>
            <p className="section-kicker">{t("operationsConsole")}</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.35rem]">
              {business.business_type === "property" ? t("listingsCalendar") : t("inventoryCalendar")}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              Manage listings, blocked date ranges, and reservation flow for {business.name}. The
              selected listing anchors the calendar and all operational controls below.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--destructive-border)] bg-[var(--destructive-bg)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Blocked Windows
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-soft)]">
                {visibleBlocks.length}
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Current blocked date entries in the active calendar view.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Reservation Value
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--accent-soft)]">
                ${(totalRevenue / 100).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Reservation amount visible for the current listing scope.
              </p>
            </div>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p>{errorMessage}</p>
          {errorDetail ? <p className="mt-2 text-xs text-red-300">Details: {errorDetail}</p> : null}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      {warningMessage ? (
        <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-muted)] px-4 py-3 text-sm text-[var(--accent-soft)]">
          {warningMessage}
        </div>
      ) : null}

      {propertyList.length === 0 ? (
        <section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-yellow-200">Quickstart</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">{quickstart.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-yellow-100/90">
            {quickstart.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="#create-listing"
              className="rounded-md bg-[var(--success)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--success)]"
            >
              {quickstart.primaryLabel}
            </a>
            <Link
              href={quickstart.secondaryHref}
              className="rounded-md border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--accent-muted)]"
            >
              {quickstart.secondaryLabel}
            </Link>
          </div>
        </section>
      ) : null}
      <section className="grid gap-6 xl:grid-cols-[320px,1fr]">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">{t("listings")}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Listing selector
              </h2>
            </div>
            <span className="status-chip">{propertyList.length} listings</span>
          </div>

          {propertyList.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-6 text-sm text-[var(--text-soft)]">
              Create a listing to activate the calendar and availability controls. Use the quickstart below to save your first real property or rental item.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {propertyList.map((property) => {
                const isSelected = String(property.id) === autoSelectedPropertyId;

                return (
                  <Link
                    key={property.id}
                    href={`/admin/rentals?property=${encodeURIComponent(String(property.id))}`}
                    className={`block rounded-2xl border p-4 ${
                      isSelected
                        ? "border-[var(--accent-border)] bg-[var(--accent-muted)] shadow-[var(--shadow-soft)]"
                        : "border-[var(--border-soft)] bg-[var(--surface-raised)] hover:border-[var(--destructive-border)] hover:bg-[var(--surface-raised)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--text-strong)]">
                          {property.name || "Listing"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text-soft)]">
                          ${Number(property.price || 0).toFixed(2)}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        {isSelected ? "Active" : "View"}
                      </span>
                    </div>
                    {property.description ? (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-soft)]">
                        {property.description}
                      </p>
                    ) : null}
                  </Link>
                );
              })}

              {propertyList.length > 1 ? (
                <Link
                  href="/admin/rentals"
                  className="btn-ghost inline-flex px-4 py-2 text-sm font-medium"
                >
                  Clear selection
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <RentalsCalendarPanel
          selectedProperty={selectedProperty}
          propertyCount={propertyList.length}
          reservations={visibleReservations}
          blocks={visibleBlocks}
          propertyNameById={propertyNameById}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div id="create-listing" className="premium-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">{t("listings")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
            Save rental inventory with structured pricing and optional descriptive copy.
          </p>
          <form action="/api/admin/rentals" method="POST" className="mt-5 space-y-4">
            <input type="hidden" name="action" value="create_property" />
            <input name="name" placeholder="Listing name" required className="input-field" />
            <textarea
              name="description"
              placeholder="Description"
              className="input-field min-h-[132px]"
            />
            <input
              name="price"
              type="number"
              step="0.01"
              placeholder="Price per stay or day"
              required
              className="input-field"
            />
            <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
              Save Listing
            </button>
          </form>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Block dates</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
            Reserve unavailable windows for maintenance, owner stays, or internal holds.
          </p>

          {propertyList.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-4 text-sm text-[var(--text-soft)]">
              Create a listing first, then return here to block dates for it.
            </div>
          ) : (
            <form action="/api/admin/rentals" method="POST" className="mt-5 space-y-4">
              <input type="hidden" name="action" value="block_dates" />

              {propertyList.length === 1 ? (
                <>
                  <input type="hidden" name="property_id" value={autoSelectedPropertyId} />
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--text-soft)]">
                    Listing: {propertyList[0].name}
                  </div>
                </>
              ) : (
                <select
                  name="property_id"
                  required
                  defaultValue={autoSelectedPropertyId}
                  className="input-field"
                >
                  <option value="">Select listing</option>
                  {propertyList.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <input name="start_date" type="date" required className="input-field" />
                <input name="end_date" type="date" required className="input-field" />
              </div>
              <input
                name="reason"
                placeholder="Reason (cleaning, owner stay, maintenance)"
                className="input-field"
              />
              <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
                Block Dates
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Amenities</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
              Structured listing details
            </h2>
          </div>
          {selectedProperty ? <span className="status-chip">{selectedProperty.name}</span> : null}
        </div>

        {selectedProperty ? (
          <form action="/api/admin/rentals" method="POST" className="mt-5 space-y-6">
            <input type="hidden" name="action" value="update_property" />
            <input type="hidden" name="property_id" value={selectedProperty.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Listing name</p>
                <input
                  name="name"
                  defaultValue={selectedProperty.name || ""}
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
                  defaultValue={String(selectedProperty.price || "")}
                  required
                  className="input-field"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-[var(--text-soft)]">Bedrooms</p>
                <select
                  name="bedrooms"
                  defaultValue={
                    selectedPropertyAmenities.bedrooms === null
                      ? ""
                      : String(selectedPropertyAmenities.bedrooms)
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
                  defaultValue={
                    selectedPropertyAmenities.bathrooms === null
                      ? ""
                      : String(selectedPropertyAmenities.bathrooms)
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
                  defaultValue={selectedProperty.description || ""}
                  className="input-field min-h-[132px]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-raised)] p-5">
              <div className="flex flex-wrap gap-3">
                {selectedPropertyCountHighlights.length > 0 ? (
                  selectedPropertyCountHighlights.map((item) => (
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
                      defaultChecked={selectedPropertyAmenities[amenity.key]}
                      className="h-4 w-4"
                    />
                    <StructuredIcon
                      name={amenity.icon}
                      className="h-4 w-4 text-[var(--accent-soft)]"
                    />
                    <span>{amenity.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
              Save Amenities
            </button>
          </form>
        ) : propertyList.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-soft)]">
            Create a listing first, then return here to assign bedrooms, bathrooms, and amenities.
          </p>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-soft)]">
            Select a listing from the left to edit its structured amenities.
          </p>
        )}
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">{t("inventory")}</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">{t("listings")}</h2>
          </div>
          <span className="text-sm text-[var(--text-soft)]">{propertyList.length} saved</span>
        </div>
        <div className="mt-5 space-y-3">
          {propertyList.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No listings saved yet.</p>
          ) : (
            propertyList.map((property) => (
              <div key={property.id} className="table-row-panel px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--text-strong)]">
                      {property.name || "Listing"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      ${Number(property.price || 0).toFixed(2)}
                    </p>
                    {(() => {
                      const amenityData = normalizePropertyAmenityData(property.amenity_data);
                      const summary = [
                        formatAmenityCount(amenityData.bedrooms, "bedroom"),
                        formatAmenityCount(amenityData.bathrooms, "bathroom"),
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      const normalizedSummary = summary.replace(/\u00e2\u20ac\u00a2/g, "\u2022");

                      return normalizedSummary ? (
                        <p className="mt-1 text-sm text-[var(--accent-soft)]">
                          {normalizedSummary}
                        </p>
                      ) : null;
                    })()}
                    {property.description ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                        {property.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{property.id}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Blocked Dates</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Unavailable windows
              </h2>
            </div>
            {selectedProperty ? <span className="status-chip">{selectedProperty.name}</span> : null}
          </div>
          {selectedProperty ? (
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Showing blocked dates for {selectedProperty.name}.
            </p>
          ) : propertyList.length > 1 ? (
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Select a listing to keep this availability view focused on one property.
            </p>
          ) : null}
          <div className="mt-5 space-y-3">
            {visibleBlocks.length === 0 ? (
              <p className="text-sm text-[var(--text-soft)]">No blocked dates.</p>
            ) : (
              visibleBlocks.map((block) => (
                <div key={block.id} className="table-row-panel px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">
                        {propertyNameById.get(String(block.property_id)) || "Listing"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {formatReservationRange(block.start_date, block.end_date)}
                      </p>
                      {block.reason ? (
                        <p className="mt-2 text-sm text-[var(--text-soft)]">{block.reason}</p>
                      ) : null}
                    </div>
                    <form action="/api/admin/rentals" method="POST">
                      <input type="hidden" name="action" value="unblock_dates" />
                      <input type="hidden" name="block_id" value={block.id} />
                      <button
                        type="submit"
                        className={getAdminActionButtonClass("danger")}
                      >
                        Remove blocked dates
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">{t("reservations")}</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                Active {t("reservations").toLowerCase()}
              </h2>
            </div>
            <span className="text-sm text-[var(--text-soft)]">
              {visibleReservations.length} visible
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {visibleReservations.length === 0 ? (
              <p className="text-sm text-[var(--text-soft)]">No reservations yet.</p>
            ) : (
              visibleReservations.map((reservation) => (
                (() => {
                  const displayRange = getBookingDisplayRange(reservation);

                  return (
                    <div key={reservation.id} className="table-row-panel px-4 py-4">
                      <p className="font-medium text-[var(--text-strong)]">
                        {getReservationGuestLabel(reservation)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {propertyNameById.get(String(reservation.property_id)) || "Listing"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {formatReservationRange(
                          displayRange?.startDate || reservation.check_in_date,
                          displayRange?.endDate || reservation.check_out_date
                        )}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {reservation.guest_email || "No email"}{" "}
                        {reservation.guest_phone ? `| ${reservation.guest_phone}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAdminStatusBadgeClass(
                            reservation.status
                          )}`}
                        >
                          {formatAdminStatusLabel(reservation.status, "Pending")}
                        </span>
                        <span className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-medium text-[var(--text-soft)]">
                          Payment {formatAdminStatusLabel(reservation.payment_status, "Pending")}
                        </span>
                        <span className="inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-3 py-1 text-xs font-medium text-[var(--accent-soft)]">
                          ${(Number(reservation.amount_total || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                      {conversationIdByBookingId.get(String(reservation.id)) ? (
                        <Link
                          href={`/admin/messages?businessId=${encodeURIComponent(
                            business.id
                          )}&conversation=${encodeURIComponent(
                            String(conversationIdByBookingId.get(String(reservation.id)))
                          )}`}
                          className="mt-3 inline-flex text-sm font-medium text-[var(--accent-soft)] hover:text-[var(--accent-soft)]"
                        >
                          Reply to guest
                        </Link>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3">
                        {getReservationActions(reservation.status).map((action) => (
                          <form
                            key={`${reservation.id}-${action.status}`}
                            action="/api/admin/rentals/reservations/status"
                            method="POST"
                          >
                            <input type="hidden" name="id" value={reservation.id} />
                            <input type="hidden" name="status" value={action.status} />
                            <button type="submit" className={action.className}>
                              {action.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}


