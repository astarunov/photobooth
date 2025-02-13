import type { Metadata } from "next";
import "./globals.css";
import Background from "@/app/_components/Background";

const basePath = process.env.NODE_ENV === "production" ? "/photobooth" : "";

export const metadata: Metadata = {
  title: "Photobooth",
  description: "Capture the moment",
  icons: {
    icon: `${basePath}/favicons/favicon.ico`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative overflow-hidden">
        <Background>{children}</Background>
      </body>
    </html>
  );
}
