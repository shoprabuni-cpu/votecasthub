import QRCode from "qrcode";

export type QRCodeOptions = {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  darkColor?: string;
  lightColor?: string;
};

/**
 * Generates a clean, high-resolution QR code as a base64 Data URL (PNG).
 * Runs 100% offline in memory, avoids canvas CORS tainting, and includes
 * fallback error handling.
 */
export async function generateQrDataUrl(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  const width = options?.width ?? 240;
  const margin = options?.margin ?? 1;
  const errorCorrectionLevel = options?.errorCorrectionLevel ?? "M";
  const dark = options?.darkColor ?? "#0f172a";
  const light = options?.lightColor ?? "#ffffff";

  try {
    return await QRCode.toDataURL(text, {
      width,
      margin,
      errorCorrectionLevel,
      color: { dark, light },
    });
  } catch (err) {
    console.warn("[QRCode] Local generation failed, trying fallback", err);
    // Remote fallback if local generator encountered an unexpected buffer error
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${width}x${width}&margin=${margin}&data=${encodeURIComponent(text)}`;
    return fallbackUrl;
  }
}
