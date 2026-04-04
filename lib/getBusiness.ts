import { getActiveBusiness } from "@/lib/getActiveBusiness";

export async function getCurrentBusiness(requestedBusinessId?: string | null) {
  return getActiveBusiness(requestedBusinessId);
}
