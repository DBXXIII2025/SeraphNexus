import type { SVGProps } from "react";

export type StructuredIconName =
  | "mapPin"
  | "property"
  | "food"
  | "store"
  | "creator"
  | "service";

type StructuredIconProps = SVGProps<SVGSVGElement> & {
  name: StructuredIconName;
};

export default function StructuredIcon({
  name,
  className,
  ...props
}: StructuredIconProps) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
    ...props,
  };

  switch (name) {
    case "mapPin":
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "property":
      return (
        <svg {...commonProps}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case "food":
      return (
        <svg {...commonProps}>
          <path d="M7 4v8" />
          <path d="M10 4v8" />
          <path d="M7 8h3" />
          <path d="M16 4v16" />
          <path d="M14 12h4" />
        </svg>
      );
    case "store":
      return (
        <svg {...commonProps}>
          <path d="M4 8h16l-1 12H5L4 8Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
      );
    case "creator":
      return (
        <svg {...commonProps}>
          <path d="m12 3 2.5 5 5.5.8-4 3.8.9 5.4-4.9-2.6L7.1 18l.9-5.4-4-3.8 5.5-.8Z" />
        </svg>
      );
    case "service":
      return (
        <svg {...commonProps}>
          <path d="M4 14.5 14.5 4a2.1 2.1 0 0 1 3 0l2.5 2.5a2.1 2.1 0 0 1 0 3L9.5 20H4v-5.5Z" />
          <path d="m13 6 5 5" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
