import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegister from "./sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inventario LinaDigest",
  description: "Control de stock, entradas y salidas de LinaDigest.",
  other: { "codex-preview": "development" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LinaDigest" },
  icons: {
    icon: [
      { url: "/icon-192-v3.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v3.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192-v3.png",
    apple: "/icon-192-v3.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#663078",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
