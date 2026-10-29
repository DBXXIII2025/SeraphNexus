import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function Icon({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
export function ArrowUpRight(props: IconProps) { return <Icon {...props}><path d="M7 17 17 7M7 7h10v10" /></Icon>; }
export function CalendarDays(props: IconProps) { return <Icon {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2" /></Icon>; }
export function Compass(props: IconProps) { return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3z" /></Icon>; }
export function House(props: IconProps) { return <Icon {...props}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-8h6v8" /></Icon>; }
export function LayoutGrid(props: IconProps) { return <Icon {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>; }
export function ShoppingBag(props: IconProps) { return <Icon {...props}><path d="M4 8h16l-1 13H5L4 8ZM9 9V6a3 3 0 0 1 6 0v3" /></Icon>; }
export function Sparkles(props: IconProps) { return <Icon {...props}><path d="m12 2 2.1 6.9L21 11l-6.9 2.1L12 20l-2.1-6.9L3 11l6.9-2.1L12 2ZM19 18l.8 1.2L21 20l-1.2.8L19 22l-.8-1.2L17 20l1.2-.8L19 18Z" /></Icon>; }
export function Wind(props: IconProps) { return <Icon {...props}><path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a2 2 0 1 1-2 2M4 16h8a3 3 0 1 1-3 3" /></Icon>; }
export function MessageCircle(props: IconProps) { return <Icon {...props}><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.5a9 9 0 0 1-.9-4A8.5 8.5 0 1 1 20 11.5Z" /></Icon>; }
