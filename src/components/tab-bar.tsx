"use client";

// ============================================================
// Shared navigation — SPEC §2 (information architecture) + §6.5
//
// Mobile  : fixed bottom tab bar, 56px tall, safe-area padded,
//           icon + 10px label, active item filled + accent.
// Desktop : 240px left sidebar (≥1024px), same five items, with
//           the greeting block at the top.
//
// Settings deliberately lives behind a gear in the header, not
// in the nav (SPEC §2).
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  ChartColumn,
  House,
  Quote as QuoteIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: House },
  { href: "/quotes", label: "Quotes", icon: QuoteIcon },
  { href: "/plans", label: "Plans", icon: CalendarCheck },
  { href: "/pursuits", label: "Pursuits", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// ---------- mobile: fixed bottom tab bar ----------

function BottomBar() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-[var(--hairline)]",
        "bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)]",
        "supports-[backdrop-filter:blur(0px)]:backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid h-14 grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="contents">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-11 flex-col items-center justify-center gap-1",
                  "transition-colors duration-200 ease-[var(--ease-house)]",
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--ink-mute)] active:text-[var(--ink-soft)]",
                )}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 1.8 : 1.6}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.2 : 0}
                  className={active ? "drop-shadow-[0_0_7px_var(--accent)]" : undefined}
                  aria-hidden
                />
                <span className="text-[10px] leading-none font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------- desktop: 240px left sidebar ----------

function Sidebar({
  greeting,
  subline,
}: {
  greeting?: string;
  subline?: string;
}) {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-60 flex-col lg:flex",
        "border-r border-[var(--hairline)] bg-[var(--surface)]",
        "px-4 py-8",
      )}
    >
      {greeting ? (
        <div className="mb-8 px-3">
          <p className="font-display text-xl leading-tight text-[var(--ink)]">
            {greeting}
          </p>
          {subline ? (
            <p className="mt-1 text-[13px] tracking-[0.04em] text-[var(--ink-soft)]">
              {subline}
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-full px-3 py-2.5",
                  "text-sm font-medium transition-colors duration-200 ease-[var(--ease-house)]",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)] hover:text-[var(--ink)]",
                )}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 1.8 : 1.6}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.2 : 0}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The nav itself. Renders the bottom bar on mobile and the sidebar
 * on desktop — both are fixed, so this adds no layout height.
 * Pages using this directly must pad for it; `AppShell` does that.
 */
export function TabBar({
  greeting,
  subline,
}: {
  greeting?: string;
  subline?: string;
}) {
  return (
    <>
      <BottomBar />
      <Sidebar greeting={greeting} subline={subline} />
    </>
  );
}

/**
 * Page wrapper: content + nav, with the right offsets on each
 * breakpoint. Every page should use this so the fixed nav never
 * covers content.
 */
export function AppShell({
  children,
  greeting,
  subline,
  className,
}: {
  children: React.ReactNode;
  greeting?: string;
  subline?: string;
  className?: string;
}) {
  return (
    <div className="min-h-dvh lg:pl-60">
      <div
        className={cn(
          // clears the 56px bar + safe area on mobile
          "pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] lg:pb-16",
          className,
        )}
      >
        {children}
      </div>
      <TabBar greeting={greeting} subline={subline} />
    </div>
  );
}

export default TabBar;
