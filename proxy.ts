import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getMissingLegalDocumentKeys,
  isMissingLegalAcceptancesStorageError,
  normalizeLegalAcceptanceRows,
} from "@/lib/legalAcceptance";
import { getRequiredLegalDocumentKeys } from "@/lib/legalDocuments";

function isSafeNextPath(value: string | null) {
  return Boolean(value && value.startsWith("/"));
}

function isAdminProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/business-settings") ||
    pathname.startsWith("/listing-editor") ||
    pathname.startsWith("/bookings")
  );
}

function isPublicBusinessPath(pathname: string) {
  return (
    pathname.startsWith("/b/") ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/rent/") ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/shop/")
  );
}

function isBypassedPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/legal")
  );
}

function createProxyAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

async function getProxyIsPlatformAdmin(args: {
  supabaseAdmin: ReturnType<typeof createProxyAdminClient>;
  userId: string;
}) {
  const { data, error } = await args.supabaseAdmin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", args.userId)
    .maybeSingle();

  if (error) {
    console.error("[proxy/legal] platform profile lookup failed", {
      userId: args.userId,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return false;
  }

  return data?.is_platform_admin === true;
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-current-path", pathname);

  if (pathname === "/dashboard/services" || pathname.startsWith("/dashboard/services/")) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (isBypassedPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isPublicBusinessPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextParam = req.nextUrl.searchParams.get("next");
  const safeNext = isSafeNextPath(nextParam) ? nextParam! : "/admin";
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL(safeNext, req.url));
  }

  if (user && isAdminProtectedPath(pathname)) {
    try {
      const supabaseAdmin = createProxyAdminClient();
      const isPlatformAdmin = await getProxyIsPlatformAdmin({
        supabaseAdmin,
        userId: user.id,
      });

      if (isPlatformAdmin) {
        return res;
      }

      const requestedBusinessId = req.nextUrl.searchParams.get("businessId");
      const activeBusinessId =
        requestedBusinessId ||
        req.cookies.get("active_business_id")?.value ||
        null;

      let businessId = activeBusinessId;

      if (!businessId) {
        const { data: firstBusiness, error: firstBusinessError } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (firstBusinessError) {
          console.error("[proxy/legal] business lookup failed", {
            pathname,
            userId: user.id,
            message: firstBusinessError.message,
          });
          return res;
        }

        businessId = firstBusiness?.id ? String(firstBusiness.id) : null;
      }

      if (!businessId) {
        return res;
      }

      const { data: ownedBusiness, error: ownedBusinessError } = await supabase
        .from("businesses")
        .select("id, business_type")
        .eq("id", businessId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (ownedBusinessError) {
        console.error("[proxy/legal] owned business check failed", {
          pathname,
          userId: user.id,
          businessId,
          message: ownedBusinessError.message,
        });
        return res;
      }

      if (!ownedBusiness?.id) {
        return res;
      }

      const { data: legalRows, error: legalError } = await supabaseAdmin
        .from("legal_acceptances")
        .select("document_key, document_version")
        .eq("user_id", user.id)
        .eq("business_id", businessId);

      if (legalError) {
        if (isMissingLegalAcceptancesStorageError(legalError.message)) {
          console.error("[proxy/legal] storage unavailable; failing open", {
            pathname,
            userId: user.id,
            businessId,
            message: legalError.message,
          });
          return res;
        }

        console.error("[proxy/legal] acceptance lookup failed", {
          pathname,
          userId: user.id,
          businessId,
          message: legalError.message,
        });
        return res;
      }

      const missingKeys = getMissingLegalDocumentKeys(
        normalizeLegalAcceptanceRows(
          (legalRows || []) as Array<Record<string, unknown>>
        ),
        ownedBusiness.business_type
      );

      if (process.env.NODE_ENV !== "production") {
        const expectedKeys = getRequiredLegalDocumentKeys(ownedBusiness.business_type);
        const foundKeys = ((legalRows || []) as Array<Record<string, unknown>>).map(
          (row) => String(row.document_key)
        );
        console.log("[proxy/legal] check", {
          pathname,
          businessId,
          businessType: ownedBusiness.business_type || null,
          expectedKeys,
          foundKeys,
          missingKeys,
          missingCount: missingKeys.length,
        });
      }

      if (missingKeys.length > 0) {
        const acceptanceUrl = new URL("/legal/acceptance", req.url);
        acceptanceUrl.searchParams.set("businessId", businessId);
        acceptanceUrl.searchParams.set(
          "next",
          `${pathname}${req.nextUrl.search || ""}`
        );
        return NextResponse.redirect(acceptanceUrl);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown proxy error";
      console.error("[proxy/legal] unexpected failure; failing open", {
        pathname,
        userId: user.id,
        message,
      });
      return res;
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
