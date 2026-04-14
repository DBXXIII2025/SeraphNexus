import { isRentalBusinessType, type BusinessType } from "@/lib/businessModules";

export type LegalDocumentKey =
  | "terms_of_service"
  | "privacy_policy"
  | "business_owner_platform_agreement"
  | "advertising_listing_responsibility_agreement"
  | "refund_chargeback_responsibility_agreement"
  | "payment_processing_fee_disclosure_agreement"
  | "rental_property_late_fee_disclosure_agreement"
  | "messaging_communication_disclaimer";

export type LegalDocumentSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  documentKey: LegalDocumentKey;
  documentVersion: string;
  lastUpdated: string;
  title: string;
  acceptanceLabel: string;
  requiredFor: "all" | BusinessType[];
  sections: LegalDocumentSection[];
};

const LAST_UPDATED = "2026-03-15";

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  terms_of_service: {
    documentKey: "terms_of_service",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Terms of Service",
    acceptanceLabel: "I agree to the Terms of Service.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Scope and Acceptance",
        paragraphs: [
          "These Terms of Service govern access to and use of the Seraph Nexus platform, including websites, applications, APIs, messaging tools, booking tools, listing tools, and payment-related workflows.",
          "By creating an account, accessing the platform, or using any feature, you agree to these Terms of Service and any policies or agreements incorporated by reference.",
          "If you act on behalf of a company or other legal entity, you represent that you have authority to bind that entity.",
        ],
      },
      {
        heading: "2. Definitions",
        paragraphs: [
          "\"Platform\" means the Seraph Nexus technology service.",
          "\"Business Owner\" means a user who operates or manages a business presence on the platform.",
          "\"Customer\" means an end user who browses, books, orders from, or communicates with a Business Owner through the platform.",
          "\"Services\" means the goods, rentals, reservations, appointments, listings, and related offerings provided by a Business Owner.",
        ],
      },
      {
        heading: "3. Platform Role and Independent Business Status",
        paragraphs: [
          "Seraph Nexus is a technology provider that supplies software tools for publication, operations, communication, and payment enablement. Seraph Nexus is not the operator of each listed business and is not automatically the seller, landlord, property manager, restaurant operator, contractor, travel provider, or agent for Business Owners.",
          "Business Owners are independent operators and remain solely responsible for their listings, services, pricing, availability, legal compliance, refunds, chargebacks, taxes, and customer interactions.",
        ],
      },
      {
        heading: "4. Business Owner Obligations",
        paragraphs: [
          "Business Owners must maintain accurate listings, truthful descriptions, lawful pricing, required disclosures, valid licenses, and legally compliant policies.",
          "Business Owners are solely responsible for fulfilling the listed service, honoring bookings or orders, and resolving customer complaints concerning the underlying service or transaction.",
        ],
      },
      {
        heading: "5. Payments, Refunds, and Communications",
        paragraphs: [
          "Payment processing may be provided by third-party providers. Business Owners are solely responsible for refund handling, chargeback responses, and the economic consequences of disputes arising from their services or listings.",
          "Messaging and communication tools are provided for convenience. Seraph Nexus does not guarantee message delivery, response times, or the truth of user-generated statements.",
        ],
      },
      {
        heading: "6. Disclaimers and Limitation of Liability",
        paragraphs: [
          "To the maximum extent permitted by applicable law, the platform is provided on an \"as is\" and \"as available\" basis without warranties of any kind, whether express, implied, or statutory.",
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages, or for loss of profits, revenue, customers, bookings, data, or goodwill arising from or relating to the platform or any Business Owner service.",
        ],
      },
      {
        heading: "7. Indemnification and Dispute Allocation",
        paragraphs: [
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus and its affiliates, officers, employees, and contractors from third-party claims, losses, liabilities, damages, fines, penalties, and expenses, including reasonable attorneys' fees, arising out of or related to their listings, services, advertising claims, refunds, chargebacks, communications, taxes, property conditions, or legal noncompliance.",
          "Disputes about a Business Owner's services, listings, reservations, rentals, refunds, fees, or communications are solely between the Business Owner and the affected customer or third party, except to the extent a claim directly concerns Seraph Nexus's own software obligations.",
        ],
      },
    ],
  },
  privacy_policy: {
    documentKey: "privacy_policy",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Privacy Policy",
    acceptanceLabel: "I agree to the Privacy Policy.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Scope",
        paragraphs: [
          "This Privacy Policy explains how Seraph Nexus collects, uses, stores, and discloses personal information in connection with the platform.",
          "This policy applies to Business Owners, customers, and visitors who access the platform, send messages, create accounts, complete bookings or orders, or contact support.",
        ],
      },
      {
        heading: "2. Information We Collect",
        paragraphs: [
          "We may collect account details, business profile information, contact information, booking and order records, communications, payment-related metadata, device and usage information, and support records.",
          "Payment card details may be collected and processed by integrated payment providers rather than stored directly by Seraph Nexus, depending on the payment flow used.",
        ],
      },
      {
        heading: "3. How We Use and Share Information",
        paragraphs: [
          "We use information to operate the platform, authenticate users, process transactions, support messaging, detect fraud, enforce agreements, improve the service, and comply with legal obligations.",
          "We may share information with payment providers, hosting and communications vendors, fraud prevention tools, professional advisers, regulators, and Business Owners or customers where necessary to facilitate platform functionality or comply with law.",
        ],
      },
      {
        heading: "4. Business Owner Privacy Responsibility",
        paragraphs: [
          "Business Owners are independent operators and are solely responsible for their own lawful collection, use, disclosure, retention, and protection of customer information obtained through the platform for business purposes.",
          "Business Owners must provide legally required notices, obtain required consents, and comply with applicable privacy, consumer protection, and marketing laws.",
        ],
      },
      {
        heading: "5. Retention, Security, and Rights",
        paragraphs: [
          "We retain information as reasonably necessary to operate the platform, comply with legal obligations, resolve disputes, and enforce agreements. We use commercially reasonable measures to protect information, but no system is completely secure.",
          "Depending on your jurisdiction, you may have rights to request access to, correction of, or deletion of certain personal information, subject to applicable exceptions and verification requirements.",
        ],
      },
      {
        heading: "6. Platform Disclaimer, Liability, and Indemnity",
        paragraphs: [
          "Seraph Nexus is a technology provider and does not independently verify the truth of business listings, customer statements, advertising claims, or business communications supplied by Business Owners.",
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for indirect, incidental, special, consequential, or punitive damages arising from privacy incidents, service interruptions, or unauthorized access, except where such limitation is prohibited by law.",
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus from claims, fines, losses, or expenses arising from the Business Owner's own handling of customer information or failure to comply with applicable privacy or marketing laws.",
        ],
      },
    ],
  },
  business_owner_platform_agreement: {
    documentKey: "business_owner_platform_agreement",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Business Owner Platform Agreement",
    acceptanceLabel: "I agree to the Business Owner Platform Agreement.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Purpose and Relationship",
        paragraphs: [
          "This Business Owner Platform Agreement governs the use of Seraph Nexus by independent businesses that publish listings, accept bookings or orders, message customers, configure payments, or otherwise use business-facing platform tools.",
          "Each Business Owner is an independent business and is not an employee, partner, joint venturer, franchisee, fiduciary, or legal representative of Seraph Nexus.",
        ],
      },
      {
        heading: "2. Business Owner Representations",
        paragraphs: [
          "You represent that you have the legal right to operate your business, publish your listings, offer your services, and connect payout or payment accounts for your business.",
          "You further represent that your operations comply with applicable licensing, tax, consumer protection, health and safety, anti-discrimination, advertising, lodging, rental, or professional service laws applicable to your business model.",
        ],
      },
      {
        heading: "3. Operational Responsibility",
        paragraphs: [
          "You are solely responsible for the accuracy of your listings, customer-facing policies, availability, pricing, taxes, fees, fulfillment standards, customer support, property conditions, inventory conditions, and service delivery.",
          "You are solely responsible for refunds, chargebacks, cancellations, no-shows, property access issues, fulfillment failures, labor compliance, and the acts or omissions of your staff, contractors, or agents.",
        ],
      },
      {
        heading: "4. Platform Role",
        paragraphs: [
          "Seraph Nexus provides software and workflow tooling only. The platform does not assume responsibility for the underlying goods, services, property stays, reservations, rentals, or customer outcomes offered by a Business Owner.",
        ],
      },
      {
        heading: "5. Suspension, Liability, and Indemnification",
        paragraphs: [
          "Seraph Nexus may suspend or restrict access where reasonably necessary to address fraud, elevated dispute risk, noncompliance, legal violations, or partner requirements.",
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for business interruption, processor holds, lost sales, lost bookings, or customer disputes arising from the Business Owner's operations.",
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus from claims, disputes, investigations, fines, penalties, and expenses arising from their business operations, listings, customer interactions, taxes, labor practices, refund handling, chargeback handling, or legal noncompliance.",
        ],
      },
      {
        heading: "6. Dispute Allocation",
        paragraphs: [
          "Disputes concerning the substance of a booking, order, rental, service, cancellation, refund, injury claim, or advertising claim are solely between the Business Owner and the affected customer or third party, except to the extent a claim directly concerns the platform's own software obligations.",
        ],
      },
    ],
  },
  advertising_listing_responsibility_agreement: {
    documentKey: "advertising_listing_responsibility_agreement",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Advertising & Listing Responsibility Agreement",
    acceptanceLabel:
      "I acknowledge that I am responsible for my business listings and advertising claims.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Responsibility for Listings and Advertising",
        paragraphs: [
          "Business Owners are solely responsible for the truthfulness, completeness, substantiation, and legality of all listing content, descriptions, amenities, photos, pricing, calendars, promotions, menus, and service claims published through the platform.",
          "You must not publish false, deceptive, misleading, discriminatory, unlawful, or infringing advertising or listing content.",
        ],
      },
      {
        heading: "2. Pricing, Availability, and Required Disclosures",
        paragraphs: [
          "You are solely responsible for keeping pricing, inventory, availability, cancellation rules, refund terms, late fee disclosures, taxes, and material service restrictions current and accurate.",
          "You must provide all disclosures required by applicable law for your business category and jurisdiction.",
        ],
      },
      {
        heading: "3. Intellectual Property and Rights Clearance",
        paragraphs: [
          "You represent that you own or have sufficient rights to use all content, branding, photography, logos, descriptions, and media you upload or publish.",
        ],
      },
      {
        heading: "4. Platform Disclaimer",
        paragraphs: [
          "Seraph Nexus is a technology provider and does not independently verify Business Owner listing content before publication. The platform does not guarantee the accuracy, legality, or adequacy of any Business Owner listing or promotion.",
        ],
      },
      {
        heading: "5. Liability, Indemnification, and Dispute Allocation",
        paragraphs: [
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for losses arising from inaccurate listings, misleading promotions, omitted disclosures, rejected bookings, or customer reliance on Business Owner advertising claims.",
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus from claims, regulatory actions, fines, and expenses arising from inaccurate listings, deceptive advertising, intellectual property infringement, consumer protection violations, or omitted disclosures in Business Owner content.",
          "Disputes concerning the truth, legality, or adequacy of a Business Owner's listing or advertising are solely the responsibility of the Business Owner.",
        ],
      },
    ],
  },
  refund_chargeback_responsibility_agreement: {
    documentKey: "refund_chargeback_responsibility_agreement",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Refund & Chargeback Responsibility Agreement",
    acceptanceLabel:
      "I acknowledge that I am responsible for refund handling and chargeback outcomes relating to my business.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Scope and Allocation of Responsibility",
        paragraphs: [
          "This agreement applies to all orders, bookings, reservations, rentals, appointments, and other customer transactions processed or coordinated through the platform.",
          "Business Owners are solely responsible for their refund, cancellation, return, exchange, and no-show policies, subject to applicable law.",
        ],
      },
      {
        heading: "2. Refund Handling and Chargebacks",
        paragraphs: [
          "Business Owners are solely responsible for refund decisions, customer refund communications, chargeback responses, recordkeeping, and the economic consequences of payment disputes connected to their offerings.",
          "Business Owners must maintain records sufficient to support pricing, fulfillment, cancellation, customer communications, and transaction history in the event of a dispute.",
        ],
      },
      {
        heading: "3. Platform Disclaimer",
        paragraphs: [
          "Seraph Nexus may provide tools that surface dispute information or facilitate refund workflows, but those tools do not transfer legal or financial responsibility away from the Business Owner.",
          "Seraph Nexus is not the adjudicator of refund rights between a Business Owner and a customer.",
        ],
      },
      {
        heading: "4. Limitation of Liability",
        paragraphs: [
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for refund costs, chargeback losses, processor fees, reserve holds, or negative balances arising from a Business Owner's transactions or customer disputes.",
        ],
      },
      {
        heading: "5. Indemnification and Dispute Allocation",
        paragraphs: [
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus from claims, costs, liabilities, and expenses arising from refund disputes, chargebacks, cardholder complaints, bank inquiries, or allegations that a Business Owner failed to deliver or misrepresented the purchased goods or services.",
          "Refund and chargeback disputes concerning the underlying transaction are solely between the Business Owner, the customer, and the payment provider, except to the extent a dispute directly concerns a technical processing error solely caused by Seraph Nexus.",
        ],
      },
    ],
  },
  payment_processing_fee_disclosure_agreement: {
    documentKey: "payment_processing_fee_disclosure_agreement",
    documentVersion: "2026-04-09.1",
    lastUpdated: "2026-04-09",
    title: "Payment Processing & Platform Fee Disclosure",
    acceptanceLabel:
      "I acknowledge that Seraph Nexus deducts the disclosed platform fee from customer payments processed for my business.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Scope and Payment Flow",
        paragraphs: [
          "This disclosure applies whenever your business uses Seraph Nexus payment-processing features, including bookings, reservations, orders, or other customer transactions processed through the platform with Stripe Connect.",
          "Customers are charged one total amount for the applicable booking or order. Seraph Nexus does not add a separate second client charge for the platform fee described in this disclosure.",
        ],
      },
      {
        heading: "2. Automatic Platform Fee Deduction",
        paragraphs: [
          "By enabling payment processing, you authorize Seraph Nexus to deduct the platform transaction fee that applies to your business's effective plan directly from customer payments processed through the platform before the net payout is transferred to your connected Stripe account.",
          "Current configured fee percentages by plan are controlled by the platform settings source of truth and shown in the platform owner and plan screens. If your effective plan changes, the platform fee percentage applied to future transactions will follow the then-current configured rate for that effective plan.",
        ],
      },
      {
        heading: "3. Transaction Accounting and Records",
        paragraphs: [
          "For each successful payment, Seraph Nexus may store transaction metadata sufficient for accounting and audit purposes, including the booking or order reference, business identifier, plan used for the fee calculation, gross amount, deducted platform fee amount, net amount routed to your connected account, and related Stripe object identifiers.",
          "Historical transaction records preserve the fee and pricing amounts that applied at the time of the original transaction and are not retroactively rewritten solely because you later change your pricing or plan.",
        ],
      },
      {
        heading: "4. Owner Responsibility and Acknowledgment",
        paragraphs: [
          "You are responsible for reviewing this disclosure, your plan terms, and your own payout reporting. You remain solely responsible for your taxes, customer disclosures, pricing decisions, refunds, and legal compliance relating to your business.",
          "If you do not accept this disclosure, you must not use Seraph Nexus payment-processing features for real customer transactions.",
        ],
      },
    ],
  },
  rental_property_late_fee_disclosure_agreement: {
    documentKey: "rental_property_late_fee_disclosure_agreement",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Rental / Property Late Fee Disclosure Agreement",
    acceptanceLabel:
      "I acknowledge that I am responsible for any rental or property late fee disclosures I publish.",
    requiredFor: ["rental", "property"],
    sections: [
      {
        heading: "1. Scope",
        paragraphs: [
          "This agreement applies to Business Owners offering rentals, property stays, accommodations, or similar time-based access arrangements through the platform.",
        ],
      },
      {
        heading: "2. Fee Disclosure Responsibility",
        paragraphs: [
          "Business Owners are solely responsible for determining whether late fees, holdover fees, overstays, cleaning fees, occupancy penalties, damage charges, or similar assessments are lawful and enforceable in the applicable jurisdiction.",
          "Business Owners must clearly disclose any such fees before a customer completes a booking or reservation where required by applicable law.",
        ],
      },
      {
        heading: "3. Legal Compliance and Platform Disclaimer",
        paragraphs: [
          "Business Owners are solely responsible for complying with lodging, rental, deposit, fee, occupancy, tax, and consumer disclosure laws that apply to their listings.",
          "Seraph Nexus provides software tools only and does not draft a Business Owner's rental contract, set a Business Owner's fees, or guarantee the legal enforceability of any fee or policy.",
        ],
      },
      {
        heading: "4. Liability and Indemnification",
        paragraphs: [
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for disputes over late fees, overstays, deposits, occupancy charges, damage claims, or property-related legal compliance.",
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus from claims, disputes, enforcement actions, penalties, or expenses arising from their rental disclosures, fee practices, property rules, or stay-related policies.",
        ],
      },
      {
        heading: "5. Dispute Allocation",
        paragraphs: [
          "Disputes about late fees, property conditions, overstays, cleaning charges, deposits, or other stay-related charges are solely between the Business Owner and the customer or regulator involved.",
        ],
      },
    ],
  },
  messaging_communication_disclaimer: {
    documentKey: "messaging_communication_disclaimer",
    documentVersion: "2026-03-15.1",
    lastUpdated: LAST_UPDATED,
    title: "Messaging & Communication Disclaimer",
    acceptanceLabel: "I acknowledge the Messaging & Communication Disclaimer.",
    requiredFor: "all",
    sections: [
      {
        heading: "1. Operational Tool Only",
        paragraphs: [
          "The platform's messaging features are provided as operational tools to facilitate communication between customers and Business Owners.",
          "Seraph Nexus does not guarantee message delivery, delivery speed, customer response, business response, or that the parties will reach an agreement or complete a transaction.",
        ],
      },
      {
        heading: "2. Responsibility for Communications",
        paragraphs: [
          "Business Owners are solely responsible for the content of their messages, including pricing statements, availability statements, refund promises, service descriptions, and customer support communications.",
          "Customers are solely responsible for the accuracy of information they provide in messages and inquiries.",
        ],
      },
      {
        heading: "3. Monitoring and Platform Disclaimer",
        paragraphs: [
          "Seraph Nexus may retain or review message content or metadata where reasonably necessary for operations, fraud prevention, customer support, legal compliance, or platform integrity.",
          "Seraph Nexus is not a party to the underlying customer-business agreement formed through communications and does not guarantee the accuracy or enforceability of user-generated message content.",
        ],
      },
      {
        heading: "4. Limitation of Liability",
        paragraphs: [
          "To the maximum extent permitted by applicable law, Seraph Nexus will not be liable for losses arising from missed messages, delayed responses, misunderstood statements, failed negotiations, or reliance on user-generated communications.",
        ],
      },
      {
        heading: "5. Indemnification and Dispute Allocation",
        paragraphs: [
          "Business Owners will defend, indemnify, and hold harmless Seraph Nexus from claims, losses, or expenses arising from Business Owner communications, including alleged misrepresentations, unlawful marketing, harassment, discrimination, refund promises, or service assurances made by the Business Owner.",
          "Disputes arising from the content of communications between a customer and a Business Owner are solely between those parties, except to the extent a claim directly concerns a technical platform failure caused by Seraph Nexus.",
        ],
      },
    ],
  },
};

export const BUSINESS_OWNER_REQUIRED_DOCUMENT_KEYS: LegalDocumentKey[] = [
  "terms_of_service",
  "privacy_policy",
  "business_owner_platform_agreement",
  "advertising_listing_responsibility_agreement",
  "refund_chargeback_responsibility_agreement",
  "payment_processing_fee_disclosure_agreement",
  "rental_property_late_fee_disclosure_agreement",
  "messaging_communication_disclaimer",
];

function documentAppliesToBusinessType(
  document: LegalDocument,
  businessType: string | null | undefined
) {
  if (document.requiredFor === "all") {
    return true;
  }

  return document.requiredFor.some((type) => type === businessType);
}

export function getLegalDocument(documentKey: string) {
  if (documentKey in LEGAL_DOCUMENTS) {
    return LEGAL_DOCUMENTS[documentKey as LegalDocumentKey];
  }

  return null;
}

export function getRequiredLegalDocumentKeys(
  businessType: string | null | undefined
) {
  return BUSINESS_OWNER_REQUIRED_DOCUMENT_KEYS.filter((documentKey) =>
    documentAppliesToBusinessType(LEGAL_DOCUMENTS[documentKey], businessType)
  );
}

export function getRequiredBusinessOwnerDocuments(
  businessType: string | null | undefined
) {
  return getRequiredLegalDocumentKeys(businessType).map(
    (documentKey) => LEGAL_DOCUMENTS[documentKey]
  );
}

export function requiresRentalLegalDisclosure(
  businessType: string | null | undefined
) {
  return isRentalBusinessType(businessType);
}
