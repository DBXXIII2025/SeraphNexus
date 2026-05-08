export const BUSINESS_RUNTIME_SELECT_LEGACY = [
  "id",
  "created_at",
  "owner_id",
  "name",
  "description",
  "is_published",
  "slug",
  "business_type",
  "stripe_account_id",
  "stripe_customer_id",
  "stripe_onboarding_complete",
  "stripe_charges_enabled",
  "stripe_payouts_enabled",
  "language",
  "pickup_enabled",
  "delivery_enabled",
  "onsite_enabled",
  "remote_enabled",
  "plan",
].join(", ");

export const BUSINESS_RUNTIME_SELECT_WITH_SERVICE_CATEGORY = [
  BUSINESS_RUNTIME_SELECT_LEGACY,
  "service_category",
].join(", ");

export const BUSINESS_RUNTIME_SELECT = BUSINESS_RUNTIME_SELECT_LEGACY;
