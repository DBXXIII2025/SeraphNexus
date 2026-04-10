import type { ReactNode } from "react";
import Link from "next/link";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { getPlanLimit } from "@/lib/planConfig";
import { getTenantQuickstart } from "@/lib/tenantQuickstart";
import ServiceImagesManager from "./ServiceImagesManager";
import { sortServiceImages, type ServiceImageRecord } from "@/lib/serviceImages";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

type ServiceRow = {
  id: string;
  name: string | null;
  duration?: number | null;
  price?: number | null;
  description?: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

function StatusMessage({
  tone,
  children,
}: {
  tone: "success" | "error" | "warning";
  children: ReactNode;
}) {
  const className =
    tone === "success"
      ? "rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200"
      : tone === "warning"
        ? "rounded-xl border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] p-4 text-sm text-[var(--accent-gold-soft)]"
        : "rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200";

  return <div className={className}>{children}</div>;
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const business = await getActiveBusiness();
  const isDev = process.env.NODE_ENV !== "production";
  const maxServices = business ? getPlanLimit(business.plan, "max_services") : null;

  if (!business) {
    return <div className="empty-state">No active business.</div>;
  }

  if (business.business_type !== "service") {
    return (
      <div className="surface-card p-6 text-[var(--text-main)]">
        Services are only available for service businesses.
      </div>
    );
  }

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  const {
    data: serviceImages,
    error: serviceImagesError,
  } = await supabaseAdmin
    .from("service_images")
    .select(
      "id, service_id, business_id, image_url, storage_path, alt_text, sort_order, is_primary, created_at"
    )
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (isDev) {
    console.log("[admin/services] active business_type:", business.business_type || null);
    console.log("[admin/services] count:", services?.length || 0);
    if (serviceImagesError) {
      console.log("[admin/services] service image query failed:", serviceImagesError.message);
    }
  }

  const quickstart = getTenantQuickstart(business.business_type);
  const serviceRows = (services || []) as ServiceRow[];
  const hasNoServices = serviceRows.length === 0;
  const imageRows = serviceImagesError ? [] : ((serviceImages || []) as ServiceImageRecord[]);
  const imagesByServiceId = new Map<string, ServiceImageRecord[]>();

  imageRows.forEach((image) => {
    const current = imagesByServiceId.get(image.service_id) || [];
    current.push(image);
    imagesByServiceId.set(image.service_id, sortServiceImages(current));
  });

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      {params?.success === "created" ? <StatusMessage tone="success">Service created.</StatusMessage> : null}
      {params?.success === "updated" ? <StatusMessage tone="success">Service updated.</StatusMessage> : null}
      {params?.success === "deleted" ? <StatusMessage tone="success">Service deleted.</StatusMessage> : null}
      {params?.success === "archived" ? (
        <StatusMessage tone="success">Service archived safely.</StatusMessage>
      ) : null}
      {params?.success === "restored" ? (
        <StatusMessage tone="success">Service restored to the live catalog.</StatusMessage>
      ) : null}

      {params?.error === "service-limit" ? (
        <StatusMessage tone="warning">
          Trial workspaces can save up to 5 services. Upgrade to Pro or Elite for an unlimited
          service catalog.
        </StatusMessage>
      ) : null}

      {params?.error === "invalid-service" ? (
        <StatusMessage tone="error">Enter a valid service name and price.</StatusMessage>
      ) : null}

      {params?.error === "save-failed" ? (
        <StatusMessage tone="error">Service could not be saved.</StatusMessage>
      ) : null}

      {params?.error === "service-delete-failed" ||
      params?.error === "service-archive-failed" ||
      params?.error === "service-state-failed" ? (
        <StatusMessage tone="error">
          Service action failed. Historical records were left intact.
        </StatusMessage>
      ) : null}

      {maxServices !== null ? (
        <StatusMessage tone="warning">
          Trial workspaces can save up to {maxServices} services. Upgrade to Pro or Elite for an
          unlimited service catalog.
        </StatusMessage>
      ) : null}

      <section className="premium-card p-6 lg:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
          <div>
            <p className="section-kicker">Services</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--text-strong)] lg:text-[2.2rem]">
              Service catalog
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
              Manage bookable services, pricing, and compact premium cover visuals for {business.name}.
            </p>
          </div>

          <div className="surface-panel p-5">
            <p className="section-kicker">Action Priority</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a href="#create-service" className="btn-primary px-4 py-2 text-sm font-medium">
                {hasNoServices ? quickstart.primaryLabel : "Add service"}
              </a>
              <Link href="/admin/bookings" className="btn-secondary px-4 py-2 text-sm font-medium">
                View bookings
              </Link>
              <Link href="/admin/messages" className="btn-secondary px-4 py-2 text-sm font-medium">
                View messages
              </Link>
              <Link
                href={quickstart.secondaryHref}
                className="btn-secondary px-4 py-2 text-sm font-medium"
              >
                {quickstart.secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {serviceImagesError ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          Service image storage is not configured yet. Apply{" "}
          <span className="font-mono text-amber-50">sql/migrations/20260401_service_images.sql</span>{" "}
          to create the table and bucket. Upload controls stay hidden until that migration is available.
        </div>
      ) : null}

      {hasNoServices ? (
        <section className="surface-card p-6">
          <p className="section-kicker">Quickstart</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
            {quickstart.title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
            {quickstart.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="#create-service" className="btn-primary px-4 py-2 text-sm font-medium">
              {quickstart.primaryLabel}
            </a>
            <Link href={quickstart.secondaryHref} className="btn-secondary px-4 py-2 text-sm font-medium">
              {quickstart.secondaryLabel}
            </Link>
          </div>
        </section>
      ) : null}

      <section id="create-service" className="surface-card p-6">
        <div className="section-header">
          <div className="section-header-copy">
            <p className="section-kicker">Create</p>
            <h2 className="section-title">Add service</h2>
            <p className="section-description">
              Add a new bookable offer and keep the list operationally tight.
            </p>
          </div>
        </div>

        <form action="/api/admin/services" method="POST" className="mt-5 space-y-4">
          <input type="hidden" name="business_id" value={business.id} />
          <input type="hidden" name="action" value="save" />
          <div className="grid gap-3 md:grid-cols-3">
            <input name="name" placeholder="Service name" required className="input-field" />
            <input
              name="price"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Price"
              required
              className="input-field"
            />
            <input
              name="duration"
              type="number"
              min="1"
              placeholder="Duration in minutes"
              className="input-field"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="category" placeholder="Category (optional)" className="input-field" />
            <textarea
              name="description"
              placeholder="Description (optional)"
              className="input-field min-h-[110px]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Service image uploads appear after the service is saved and shows up below.
            </p>
            <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
              Add service
            </button>
          </div>
        </form>
      </section>

      {hasNoServices ? (
        <div className="empty-state">
          No services yet. Add your first real service above to unlock booking-ready setup.
        </div>
      ) : (
        <div className="space-y-4">
          {serviceRows.map((service) => {
            const serviceImagesForCard = imagesByServiceId.get(service.id) || [];
            const primaryImage =
              serviceImagesForCard.find((image) => image.is_primary) || serviceImagesForCard[0] || null;
            const secondaryImages = serviceImagesForCard
              .filter((image) => image.id !== primaryImage?.id)
              .slice(0, 3);

            return (
              <section key={service.id} className="surface-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="space-y-2">
                      <div className="h-[76px] w-[76px] overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(15,12,12,0.92))]">
                        {primaryImage?.image_url ? (
                          <img
                            src={primaryImage.image_url}
                            alt={primaryImage.alt_text || `${service.name || "Service"} cover`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)]">
                            Brand
                          </div>
                        )}
                      </div>
                      {secondaryImages.length > 0 ? (
                        <div className="flex gap-1.5">
                          {secondaryImages.map((image) => (
                            <div
                              key={image.id}
                              className="h-8 w-8 overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[rgba(15,12,12,0.88)]"
                            >
                              {image.image_url ? (
                                <img
                                  src={image.image_url}
                                  alt={image.alt_text || `${service.name || "Service"} thumbnail`}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-[var(--text-strong)]">{service.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="status-chip">{service.duration || 30} min</span>
                        <span className="status-chip">
                          {service.is_active === false ? "Archived" : "Active"}
                        </span>
                        {service.category ? <span className="status-chip">{service.category}</span> : null}
                        <span className="status-chip">
                          {serviceImagesForCard.length > 0
                            ? `${serviceImagesForCard.length} visual${serviceImagesForCard.length === 1 ? "" : "s"}`
                            : "Premium fallback"}
                        </span>
                      </div>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                        {service.description ||
                          "Compact service visuals stay polished on the public booking flow and keep the service card easy to scan."}
                      </p>
                    </div>
                  </div>

                  <div className="table-row-panel px-4 py-3 text-right lg:min-w-[150px]">
                    <p className="section-kicker">Price</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--text-strong)]">
                      ${Number(service.price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <form action="/api/admin/services" method="POST" className="mt-5 space-y-4">
                  <input type="hidden" name="action" value="save" />
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="business_id" value={business.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      name="name"
                      defaultValue={service.name || ""}
                      placeholder="Service name"
                      required
                      className="input-field"
                    />
                    <input
                      name="category"
                      defaultValue={service.category || ""}
                      placeholder="Category"
                      className="input-field"
                    />
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={Number(service.price || 0).toFixed(2)}
                      placeholder="Price"
                      required
                      className="input-field"
                    />
                    <input
                      name="duration"
                      type="number"
                      min="1"
                      defaultValue={service.duration || 30}
                      placeholder="Duration in minutes"
                      className="input-field"
                    />
                  </div>
                  <textarea
                    name="description"
                    defaultValue={service.description || ""}
                    placeholder="Description"
                    className="input-field min-h-[120px]"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" className="btn-primary px-4 py-2 text-sm font-medium">
                      Save changes
                    </button>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-3">
                  {service.is_active === false ? (
                    <form action="/api/admin/services" method="POST">
                      <input type="hidden" name="action" value="restore" />
                      <input type="hidden" name="id" value={service.id} />
                      <input type="hidden" name="business_id" value={business.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        confirmMessage={`Restore ${service.name || "this service"} to the live booking catalog?`}
                        className="btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        Restore service
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <form action="/api/admin/services" method="POST">
                      <input type="hidden" name="action" value="archive" />
                      <input type="hidden" name="id" value={service.id} />
                      <input type="hidden" name="business_id" value={business.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        confirmMessage={`Archive ${service.name || "this service"} and hide it from future bookings?`}
                        className="btn-secondary px-4 py-2 text-sm font-medium"
                      >
                        Archive service
                      </ConfirmSubmitButton>
                    </form>
                  )}

                  <form action="/api/admin/services" method="POST">
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="business_id" value={business.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      confirmMessage={`Delete ${service.name || "this service"} if it has no history, or archive it if historical bookings depend on it?`}
                      className="rounded-md border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
                    >
                      Delete service
                    </ConfirmSubmitButton>
                  </form>
                </div>

                {!serviceImagesError ? (
                  <ServiceImagesManager
                    businessId={business.id}
                    serviceId={service.id}
                    serviceName={service.name || "Service"}
                    initialImages={serviceImagesForCard}
                  />
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                    Image uploads are unavailable for this saved service until the{" "}
                    <span className="font-mono text-amber-50">service_images</span> migration is applied.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
