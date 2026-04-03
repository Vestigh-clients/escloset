import type { CommerceConfig, PaymentMode, PaystackChargeBearer } from "./store.types.ts";

export const commerceConfig: CommerceConfig = {
  features: {
    tryOn: true,
    guestCheckout: true,
    discountCodes: true,
    orderTracking: true,
    reviews: true,
    wishlist: false,
  },
  payments: {
    // "subaccount" = Tier 1 (Vestigh-managed split), "own_account" = Tier 2 (client keeps 100%)
    mode: "subaccount" as PaymentMode,
    paystack: {
      // Safe for the frontend. For Tier 1 this is Vestigh's key; for Tier 2 this is the client's key.
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ?? "",
      subaccount: {
        code: import.meta.env.VITE_PAYSTACK_SUBACCOUNT_CODE ?? "",
        platformFeePercent: 5,
        bearer: "subaccount" as PaystackChargeBearer,
      },
      // The actual secret lives in Supabase edge function secrets, never in the frontend.
      secretKeyRef: "PAYSTACK_SECRET_KEY",
    },
  },
};
