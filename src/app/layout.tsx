import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ask-the-creator",
  description: "Chat with any YouTuber, powered by their own video transcripts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
