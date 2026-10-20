"use client";

import {
  ClipboardList,
  Compass,
  type LucideIcon,
  Map as MapIcon,
  Plane,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, type TouchEvent } from "react";

import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { FlightRuntime } from "~/features/fly/flight-runtime";
import { FlightRecovery } from "~/features/fly/flight-recovery";
import { useFlightSync } from "~/stores/flight-sync";
import { type MessageKey } from "~/i18n/messages";

const nav: { href: string; label: MessageKey; icon: LucideIcon }[] = [
  { href: "/", label: "nav.planner", icon: ClipboardList },
  { href: "/map", label: "nav.graphicalPlan", icon: MapIcon },
  { href: "/aircraft", label: "nav.aircraft", icon: Plane },
  { href: "/inspire", label: "nav.inspire", icon: Compass },
];

/** Pages render their own top-right actions here (see usePageActions). */
export const PAGE_ACTIONS_ID = "page-actions";

/** As in the original planner: no bar, a floating settings button top left and page actions top right. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const startTouch = (event: TouchEvent<HTMLAnchorElement>) => {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const finishTouch = (event: TouchEvent<HTMLAnchorElement>, href: string) => {
    const touch = event.changedTouches[0];
    const start = touchStart.current;
    touchStart.current = null;
    if (
      start &&
      touch &&
      event.touches.length === 0 &&
      Math.hypot(touch.clientX - start.x, touch.clientY - start.y) < 10
    ) {
      // iPad may suppress the synthetic click after map gestures; a stationary tap still navigates.
      event.preventDefault();
      router.push(href);
    }
  };
  const recoveryReady = useFlightSync((s) => s.phase === "ready");
  const variant = (href: string) => (pathname === href ? "default" : "outline");

  return (
    <div className="flex min-h-dvh flex-col">
      <FlightRecovery />
      {recoveryReady && <FlightRuntime />}
      <header
        className={`flex flex-wrap items-center gap-2 px-4 pt-4 ${pathname === "/map" ? "relative z-50" : ""}`}
      >
        <nav className="flex flex-wrap gap-2">
          <Button
            asChild
            variant={variant("/settings")}
            size="icon"
            className="size-13.5 rounded-2xl max-sm:size-12"
          >
            <Link href="/settings" aria-label={t("nav.settings")}>
              <Settings className="size-5" />
            </Link>
          </Button>
          {nav.map((item) => (
            <Button
              key={item.href}
              asChild
              variant={variant(item.href)}
              className="h-13.5 max-sm:size-12"
            >
              {/* Icons only on phones, so the header stays two rows. */}
              <Link
                href={item.href}
                onTouchStart={startTouch}
                onTouchEnd={(event) => finishTouch(event, item.href)}
              >
                <item.icon className="size-5 sm:hidden" />
                <span className="max-sm:sr-only">{t(item.label)}</span>
              </Link>
            </Button>
          ))}
        </nav>
        <div
          id={PAGE_ACTIONS_ID}
          className="ml-auto flex flex-wrap items-center gap-2"
        />
      </header>
      <main className="flex flex-1 flex-col p-4">{children}</main>
    </div>
  );
}
