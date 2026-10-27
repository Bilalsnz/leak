import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeakCheck | Zcash public-exposure checker",
  description: "See what a Zcash transaction exposes on the public chain.",
  metadataBase: new URL("https://leakcheck.vercel.app"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
