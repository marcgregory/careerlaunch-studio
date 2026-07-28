import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AnalyticsProvider } from "../lib/analytics";
import { QueryProvider } from "../lib/query-provider";
import { NavigationOverlayProvider } from "../lib/navigation-overlay";
import { Toaster } from "sonner";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://careerlaunch-studio.vercel.app";

export const viewport: Viewport = {
  themeColor: "#123c3a",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "CareerLaunch Studio — Role-Tailored Resume & Career Builder",
    template: "%s | CareerLaunch Studio",
  },
  description:
    "Build ATS-safe, role-tailored resumes, cover letters, and career documents with surgical precision.",
  keywords: [
    "resume builder",
    "AI resume maker",
    "ATS resume template",
    "job application tracker",
    "cover letter generator",
    "career launch studio",
    "resume tailor",
  ],
  authors: [{ name: "CareerLaunch Studio Team" }],
  creator: "CareerLaunch Studio",
  publisher: "CareerLaunch Studio",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "CareerLaunch Studio",
    title: "CareerLaunch Studio — Role-Tailored Resume & Career Builder",
    description:
      "Build ATS-safe, role-tailored resumes, cover letters, and career documents with surgical precision.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CareerLaunch Studio — Unfair Resume Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CareerLaunch Studio — Role-Tailored Resume & Career Builder",
    description:
      "Build ATS-safe, role-tailored resumes, cover letters, and career documents with surgical precision.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <QueryProvider>
          <AnalyticsProvider>
            <NavigationOverlayProvider>
              {children}
              <Toaster position="bottom-center" richColors closeButton />
            </NavigationOverlayProvider>
          </AnalyticsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
