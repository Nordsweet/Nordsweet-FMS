import "~/styles/globals.css";

import { Providers } from "~/components/shell/providers";

/** A root layout of its own: the sign-in callback must render without the AuthGate of the app. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
