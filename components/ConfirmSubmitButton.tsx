"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage?: string;
  children: ReactNode;
};

export default function ConfirmSubmitButton({
  confirmMessage,
  children,
  onClick,
  ...props
}: Props) {
  return (
    <button
      {...props}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
