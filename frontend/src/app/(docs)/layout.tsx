import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { Providers } from "~/components/providers";

export const metadata: Metadata = {
  title: "Architecture — ZENCO",
  description:
    "How a text prompt becomes a three-minute song: the constraints that shaped this system, the invariants that hold it together, and where it is knowingly weak.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

/**
 * The walkthrough runs in its own route group: no sidebar, no player, no
 * session requirement. It is a fixed-viewport reading surface, so `overflow`
 * is owned by the shell rather than the document.
 */
export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
