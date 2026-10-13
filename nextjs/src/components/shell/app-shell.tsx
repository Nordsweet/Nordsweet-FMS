"use client";

import { type LucideIcon, Map as MapIcon, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { FlightRuntime } from "~/features/fly/flight-runtime";
import { type MessageKey } from "~/i18n/messages";
import { type Language, useSettings } from "~/stores/settings";

const nav: { href: string; label: MessageKey; icon: LucideIcon }[] = [
  { href: "/map", label: "nav.map", icon: MapIcon },
];

/** Pages render their own top-right actions here (see usePageActions). */
export const PAGE_ACTIONS_ID = "page-actions";

/** As in the original planner: no bar, a floating settings button top left and page actions top right. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const language = useSettings((s) => s.language);
  const update = useSettings((s) => s.update);
  const nextLanguage: Language = language === "pl" ? "en" : "pl";
  const variant = (href: string) => (pathname === href ? "default" : "outline");

  return (
    <div className="flex min-h-dvh flex-col">
      <FlightRuntime />
      <header className="flex flex-wrap items-center gap-2 px-4 pt-4">
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
              <Link href={item.href}>
                <item.icon className="size-5 sm:hidden" />
                <span className="max-sm:sr-only">{t(item.label)}</span>
              </Link>
            </Button>
          ))}
          <Button
            variant="outline"
            className="h-13.5 max-sm:size-12"
            onClick={() => update({ language: nextLanguage })}
          >
            {nextLanguage.toUpperCase()}
          </Button>
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
