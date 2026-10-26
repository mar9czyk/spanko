import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Geist_Mono } from "next/font/google";
import { ReducedMotionProvider } from "@/components/ReducedMotionProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

// Font zaprojektowany pod czytelność przy słabym wzroku; latin-ext daje polskie znaki
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Spanko",
  description: "Baby sleep and routine assistant with a deterministic sleep engine",
  applicationName: "Spanko",
  appleWebApp: {
    capable: true,
    title: "Spanko",
    statusBarStyle: "black-translucent",
  },
  // Next 16 emituje tylko mobile-web-app-capable; starsze iOS wymagają wariantu apple-*
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F17",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang aktualizuje I18nProvider po wykryciu języka użytkownika
    <html lang="en" className={`${atkinson.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <ReducedMotionProvider>{children}</ReducedMotionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
