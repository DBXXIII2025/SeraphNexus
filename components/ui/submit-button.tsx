"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function SubmitButton({
  children,
  pendingLabel = "Saving...",
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cx(
        "btn-primary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      aria-disabled={pending || disabled}
      disabled={pending || disabled}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
