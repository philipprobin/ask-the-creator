import type { Metadata, Viewport } from "next";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask the Creator",
  description: "Chatte mit jedem YouTuber – auf Basis seiner eigenen Video-Transkripte.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
