import "~/styles/legacy.css";

import { type Metadata, type Viewport } from "next";

export const metadata: Metadata = {
  title: "Nordsweet Performance Calculator",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
