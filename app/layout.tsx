import type { Metadata } from "next";
import "./globals.css";
import Background from "@/app/_components/Background";

export const metadata: Metadata = {
  title: "Photobooth",
  description: "Capture the moment",
  icons: {
    icon: "/favicons/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative">
        <Background>{children}</Background>
      </body>
    </html>
  );
}
