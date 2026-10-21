import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";

import { AuthGate } from "~/features/auth/auth-gate";
import { AppShell } from "~/components/shell/app-shell";
import { Providers } from "~/components/shell/providers";

export const metadata: Metadata = {
  title: "Nordsweet FMS",
  description:
    "Planowanie lotu, osiągi, mapa, pogoda i komunikacja radiowa Nordsweet.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.svg", apple: "/icon-192.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className="dark">
      <body>
        <Providers>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </Providers>
      </body>
    </html>
  );
}
