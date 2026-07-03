import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerLaunch Studio",
  description: "Build role-tailored resumes, cover letters, and career documents."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

