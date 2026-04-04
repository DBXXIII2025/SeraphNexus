import { NextResponse } from "next/server";

export type ApiErrorResponseOptions = {
  status: number;
  error: string;
  code: string;
  step: string;
  extra?: Record<string, unknown>;
};

export function errorResponse({
  status,
  error,
  code,
  step,
  extra,
}: ApiErrorResponseOptions) {
  return NextResponse.json(
    {
      ok: false,
      error,
      code,
      step,
      ...(extra || {}),
    },
    { status }
  );
}

export function logRouteError(
  scope: string,
  details: {
    step: string;
    code: string;
    message: string;
    status?: number;
    error?: unknown;
    extra?: Record<string, unknown>;
  }
) {
  console.error(`[${scope}]`, {
    step: details.step,
    code: details.code,
    message: details.message,
    status: details.status ?? null,
    ...(details.extra || {}),
    error:
      details.error instanceof Error
        ? {
            name: details.error.name,
            message: details.error.message,
            stack: details.error.stack || null,
          }
        : details.error ?? null,
  });
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}
