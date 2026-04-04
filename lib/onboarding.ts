import { createAdminClient } from "@/lib/supabase/server";
import {
  getBusinessModule,
  isOrderBusinessType,
  isRentalBusinessType,
} from "@/lib/businessModules";
import { getBusinessProfileCompletion } from "@/lib/businessProfileCompletion";
import { loadMissingLegalDocumentKeysSafe } from "@/lib/legalAcceptance";
import { getPaymentReadiness } from "@/lib/paymentReadiness";

type BusinessRecord = {
  id: string;
  owner_id: string | null;
  name: string | null;
  slug: string | null;
  description?: string | null;
  business_type: string | null;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
};

export type BusinessOnboardingStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
  kind: "basics" | "profile" | "legal" | "payments" | "offerings";
};

export type BusinessOnboardingState = {
  businessId: string;
  businessName: string;
  businessType: string;
  businessLabel: string;
  workspaceHref: string;
  workspaceLabel: string;
  steps: BusinessOnboardingStep[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isComplete: boolean;
  currentStep: BusinessOnboardingStep | null;
  resumeHref: string;
  notes: string[];
};

type SetupFlowConfig = {
  workspaceHref: string;
  workspaceLabel: string;
  offeringsStep: {
    id: string;
    label: string;
    description: string;
    href: string;
  };
  notes: string[];
};

function asCount(data: Array<Record<string, unknown>> | null | undefined) {
  return Array.isArray(data) ? data.length : 0;
}

function buildLegalHref(businessId: string) {
  const params = new URLSearchParams({
    businessId,
    next: `/onboarding?businessId=${businessId}`,
  });

  return `/legal/acceptance?${params.toString()}`;
}

function buildBasicsStep(business: BusinessRecord): BusinessOnboardingStep {
  const completed = Boolean(
    business.id &&
      business.owner_id &&
      business.name &&
      business.slug &&
      business.business_type
  );

  return {
    id: "basics",
    label: "Business basics",
    description: "Business record, owner assignment, slug, and business type are saved.",
    href: `/admin/settings?businessId=${encodeURIComponent(business.id)}`,
    completed,
    kind: "basics",
  };
}

function buildProfileStep(business: BusinessRecord): BusinessOnboardingStep {
  const completion = getBusinessProfileCompletion(business);

  return {
    id: "profile",
    label: "Complete business profile",
    description: completion.summary,
    href: `/admin/customize?businessId=${encodeURIComponent(business.id)}`,
    completed: completion.canPublishProfile,
    kind: "profile",
  };
}

function buildPaymentsStep(business: BusinessRecord): BusinessOnboardingStep {
  const readiness = getPaymentReadiness(business);

  return {
    id: "payments",
    label: "Connect Stripe",
    description: readiness.summary,
    href: `/admin/settings?businessId=${encodeURIComponent(business.id)}&setup=stripe`,
    completed: readiness.canPublishLive,
    kind: "payments",
  };
}

function getSetupFlowConfig(business: BusinessRecord): SetupFlowConfig {
  const businessModule = getBusinessModule(business.business_type);

  if (isRentalBusinessType(business.business_type)) {
    return {
      workspaceHref: businessModule.primaryAdminHref,
      workspaceLabel: businessModule.primaryAdminLabel,
      offeringsStep: {
        id: "inventory",
        label:
          business.business_type === "property" ? "Add a property listing" : "Add rental inventory",
        description:
          business.business_type === "property"
            ? "Create your first property listing with pricing. Availability blocking and reservation management continue from the listings workspace."
            : "Create your first rental listing with pricing. Availability blocking and reservation management continue from the inventory workspace.",
        href: "/admin/rentals",
      },
      notes: [
        "Date blocking and reservation controls live in the rentals workspace after your first listing is saved.",
      ],
    };
  }

  if (isOrderBusinessType(business.business_type)) {
    const isMenu =
      business.business_type === "restaurant" || business.business_type === "food";

    return {
      workspaceHref: businessModule.primaryAdminHref,
      workspaceLabel: businessModule.primaryAdminLabel,
      offeringsStep: {
        id: "products",
        label: isMenu ? "Add menu items" : "Add products",
        description: isMenu
          ? "Create your first menu item so customers can start placing orders. Order operations continue in the menu and orders workspaces."
          : "Create your first product or listing so customers can browse and buy. Fulfillment continues in the products and orders workspaces.",
        href: "/admin/products",
      },
      notes: [
        isMenu
          ? "Menu and order operations stay inside the products and orders workspaces."
          : "Product and order operations stay inside the products and orders workspaces.",
      ],
    };
  }

  return {
    workspaceHref: businessModule.primaryAdminHref,
    workspaceLabel: businessModule.primaryAdminLabel,
    offeringsStep: {
      id: "services",
      label: "Add a service",
      description:
        "Create your first service with pricing so customers can start booking. Booking management continues in the services and bookings workspaces.",
      href: "/admin/services",
    },
    notes: [
      "Availability and booking operations continue from the services and bookings workspaces after your first service is saved.",
    ],
  };
}

function buildOfferingsStep(args: {
  business: BusinessRecord;
  flow: SetupFlowConfig;
  servicesCount: number;
  productsCount: number;
  propertyCount: number;
}) {
  let completed = args.servicesCount > 0;

  if (isRentalBusinessType(args.business.business_type)) {
    completed = args.propertyCount > 0;
  } else if (isOrderBusinessType(args.business.business_type)) {
    completed = args.productsCount > 0;
  }

  return {
    ...args.flow.offeringsStep,
    completed,
    kind: "offerings" as const,
  };
}

export async function getBusinessOnboardingState(args: {
  business: BusinessRecord;
  userId: string;
}) {
  const business = args.business;
  const supabaseAdmin = createAdminClient();
  const flow = getSetupFlowConfig(business);
  const notes: string[] = [];

  const [legalState, setupDataLookup] = await Promise.all([
    loadMissingLegalDocumentKeysSafe({
      supabase: supabaseAdmin,
      userId: args.userId,
      businessId: business.id,
      businessType: business.business_type,
    }),
    isRentalBusinessType(business.business_type)
      ? supabaseAdmin.from("property").select("id").eq("business_id", business.id)
      : isOrderBusinessType(business.business_type)
        ? supabaseAdmin.from("products").select("id").eq("business_id", business.id)
        : supabaseAdmin.from("services").select("id").eq("business_id", business.id),
  ]);

  if (legalState.unavailable) {
    notes.push(
      "Legal acceptance storage is unavailable, so the legal step is treated as incomplete until that storage is restored."
    );
  }

  if (setupDataLookup.error) {
    console.error("[onboarding] type-specific setup lookup failed", {
      businessId: business.id,
      businessType: business.business_type || null,
      workspaceHref: flow.workspaceHref,
      message: setupDataLookup.error.message,
      details: setupDataLookup.error.details,
      hint: setupDataLookup.error.hint,
      code: setupDataLookup.error.code,
    });
    notes.push(
      isRentalBusinessType(business.business_type)
        ? "Rental listing setup progress could not be fully verified."
        : isOrderBusinessType(business.business_type)
          ? "Product or menu setup progress could not be fully verified."
          : "Service setup progress could not be fully verified."
    );
  }

  const businessLabel = getBusinessModule(business.business_type).label;
  const servicesCount =
    !setupDataLookup.error &&
    !isRentalBusinessType(business.business_type) &&
    !isOrderBusinessType(business.business_type)
      ? asCount(setupDataLookup.data as Array<Record<string, unknown>>)
      : 0;
  const productsCount =
    !setupDataLookup.error && isOrderBusinessType(business.business_type)
      ? asCount(setupDataLookup.data as Array<Record<string, unknown>>)
      : 0;
  const propertyCount =
    !setupDataLookup.error && isRentalBusinessType(business.business_type)
      ? asCount(setupDataLookup.data as Array<Record<string, unknown>>)
      : 0;

  const steps: BusinessOnboardingStep[] = [
    buildBasicsStep(business),
    buildProfileStep(business),
    {
      id: "legal",
      label: "Accept legal documents",
      description: "Review and accept the required legal documents for this business type.",
      href: buildLegalHref(business.id),
      completed: legalState.missingDocumentKeys.length === 0,
      kind: "legal",
    },
    buildPaymentsStep(business),
    buildOfferingsStep({
      business,
      flow,
      servicesCount,
      productsCount,
      propertyCount,
    }),
  ];

  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const currentStep = steps.find((step) => !step.completed) || null;

  return {
    businessId: business.id,
    businessName: business.name || "Business",
    businessType: business.business_type || "service",
    businessLabel,
    workspaceHref: flow.workspaceHref,
    workspaceLabel: flow.workspaceLabel,
    steps,
    completedCount,
    totalCount,
    progressPercent,
    isComplete: completedCount === totalCount,
    currentStep,
    resumeHref: `/onboarding?businessId=${encodeURIComponent(business.id)}`,
    notes: [...flow.notes, ...notes],
  } satisfies BusinessOnboardingState;
}
