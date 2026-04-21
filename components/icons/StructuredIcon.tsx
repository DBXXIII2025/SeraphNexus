import type { SVGProps } from "react";

export type StructuredIconName =
  | "bed"
  | "bath"
  | "washer"
  | "dryer"
  | "dishwasher"
  | "pets"
  | "wifi"
  | "air"
  | "heating"
  | "parking"
  | "furnished"
  | "kitchen"
  | "pool"
  | "hotTub"
  | "gym"
  | "smokingAllowed"
  | "smokingNotAllowed"
  | "balcony"
  | "workspace"
  | "tv"
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
    case "bed":
      return (
        <svg {...commonProps}>
          <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
          <path d="M3 14h18" />
          <path d="M7 10V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3" />
        </svg>
      );
    case "bath":
      return (
        <svg {...commonProps}>
          <path d="M4 13h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-2Z" />
          <path d="M7 13V7a2 2 0 0 1 4 0v1" />
          <path d="M4 10h16" />
        </svg>
      );
    case "washer":
      return (
        <svg {...commonProps}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <circle cx="12" cy="13" r="4" />
          <path d="M8 7h.01M12 7h.01M16 7h.01" />
        </svg>
      );
    case "dryer":
      return (
        <svg {...commonProps}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <circle cx="12" cy="13" r="4" />
          <path d="M10 13c0-1.2.8-2.4 2.2-2.8" />
        </svg>
      );
    case "dishwasher":
      return (
        <svg {...commonProps}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8" />
          <path d="M9 12h6v5H9z" />
          <path d="M12 10v2" />
        </svg>
      );
    case "pets":
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="16" cy="8" r="1.5" />
          <circle cx="6" cy="12" r="1.5" />
          <circle cx="18" cy="12" r="1.5" />
          <path d="M9 17c1.2-2 4.8-2 6 0 .6 1 .1 2-1.3 2H10.3C8.9 19 8.4 18 9 17Z" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...commonProps}>
          <path d="M4.5 9.5a11 11 0 0 1 15 0" />
          <path d="M7.5 12.5a7 7 0 0 1 9 0" />
          <path d="M10.5 15.5a3 3 0 0 1 3 0" />
          <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "air":
      return (
        <svg {...commonProps}>
          <path d="M5 8h14" />
          <path d="M7 12h10" />
          <path d="M9 16h6" />
          <path d="M7 5l1 3M17 5l-1 3M9 14l-1 3M15 14l1 3" />
        </svg>
      );
    case "heating":
      return (
        <svg {...commonProps}>
          <path d="M12 4v10" />
          <path d="M9 8a3 3 0 1 1 6 0v6a3 3 0 1 1-6 0V8Z" />
        </svg>
      );
    case "parking":
      return (
        <svg {...commonProps}>
          <path d="M8 20V4h5a4 4 0 0 1 0 8H8" />
        </svg>
      );
    case "furnished":
      return (
        <svg {...commonProps}>
          <path d="M5 12a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5H5v-5Z" />
          <path d="M7 17v2M17 17v2M9 9V6h6v3" />
        </svg>
      );
    case "kitchen":
      return (
        <svg {...commonProps}>
          <path d="M6 4v16" />
          <path d="M10 4v7" />
          <path d="M14 4v16" />
          <path d="M18 4c0 3-2 4-2 6s2 3 2 6" />
        </svg>
      );
    case "pool":
      return (
        <svg {...commonProps}>
          <path d="M4 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
          <path d="M4 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
          <path d="M8 10V6a2 2 0 1 1 4 0v4" />
        </svg>
      );
    case "hotTub":
      return (
        <svg {...commonProps}>
          <path d="M5 12h14v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4Z" />
          <path d="M9 8c0-1 1-1 1-2M13 8c0-1 1-1 1-2M17 8c0-1 1-1 1-2" />
        </svg>
      );
    case "gym":
      return (
        <svg {...commonProps}>
          <path d="M4 10v4M20 10v4M7 8v8M17 8v8M9 12h6" />
        </svg>
      );
    case "smokingAllowed":
      return (
        <svg {...commonProps}>
          <path d="M4 15h10" />
          <path d="M17 15h2v-2" />
          <path d="M19 13c0-1.5-1-2-1-3.5S19 7 19 6" />
        </svg>
      );
    case "smokingNotAllowed":
      return (
        <svg {...commonProps}>
          <path d="M4 15h10" />
          <path d="M17 15h2v-2" />
          <path d="M5 5l14 14" />
        </svg>
      );
    case "balcony":
      return (
        <svg {...commonProps}>
          <path d="M6 4h12v6H6z" />
          <path d="M4 12h16" />
          <path d="M6 12v8M10 12v8M14 12v8M18 12v8" />
        </svg>
      );
    case "workspace":
      return (
        <svg {...commonProps}>
          <rect x="5" y="5" width="14" height="9" rx="1.5" />
          <path d="M8 19h8M12 14v5" />
        </svg>
      );
    case "tv":
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="10" rx="1.5" />
          <path d="M9 20h6M12 16v4" />
        </svg>
      );
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
