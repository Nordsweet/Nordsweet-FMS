"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { type MessageKey } from "~/i18n/messages";
import { cn } from "~/lib/utils";
import { type Language, useSettings } from "~/stores/settings";

const nav: { href: string; label: MessageKey }[] = [
  { href: "/v2", label: "nav.plan" },
  { href: "/v2/settings", label: "nav.settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const language = useSettings((s) => s.language);
  const update = useSettings((s) => s.update);
  const nextLanguage: Language = language === "pl" ? "en" : "pl";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2">
        <span className="font-semibold">{t("app.name")}</span>
        <nav className="flex gap-1">
          {nav.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(pathname === item.href && "bg-accent")}
            >
              <Link href={item.href}>{t(item.label)}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="link" size="sm">
            <Link href="/">{t("nav.legacy")}</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ language: nextLanguage })}
          >
            {nextLanguage.toUpperCase()}
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
