import type { Metadata } from "next";
import "./globals.css";
import { AnalyticsProvider } from "../lib/analytics";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "CareerLaunch Studio",
  description: "Build role-tailored resumes, cover letters, and career documents."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AnalyticsProvider>
          {children}
          <Toaster
            position="bottom-center"
            richColors
            closeButton
          />
        </AnalyticsProvider>
      </body>
    </html>
  );
}

