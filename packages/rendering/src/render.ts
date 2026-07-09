import { launchBrowser } from "./browser";

/**
 * Render an HTML string to a PDF buffer using a local Playwright browser.
 * Shared by both resume and cover-letter PDF generation.
 */
export async function renderHtmlToPdf(html: string): Promise<ArrayBuffer> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
    });
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.35in",
        right: "0.35in",
        bottom: "0.35in",
        left: "0.35in",
      },
    });

    return pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}
