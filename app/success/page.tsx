import TransactionConfirmationShell from "@/components/confirmation/TransactionConfirmationShell";

export default function SuccessPage() {
  return (
    <TransactionConfirmationShell
      confirmation={{
        state: "confirmed",
        transactionType: "service_booking",
        headline: "Transaction confirmed",
        message:
          "Your payment completed successfully and the business can now continue with the next step of your transaction.",
        nextStep:
          "Check your booking or order details from the relevant business page if you need to review anything else.",
        reference: null,
        paymentSummary: "Paid",
        businessName: "Seraph Nexus",
        businessSlug: null,
        businessType: null,
        sections: [],
      }}
    />
  );
}
