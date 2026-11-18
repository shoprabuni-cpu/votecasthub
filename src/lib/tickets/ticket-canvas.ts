import type { TicketPassData } from "@/components/tickets/visual-ticket-pass";

const SERIF_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS_FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_FONT = "'Space Grotesk', 'Courier New', monospace";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const output: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      output.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) output.push(currentLine);
  return output;
}

async function loadPhoto(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Photo unavailable");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > 12 * 1024 * 1024) {
    throw new Error("Invalid image format");
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadQrImage(qrDataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = qrDataUrl;
  });
}

export async function generateTicketImageBlob(
  ticket: TicketPassData,
  qrDataUrl: string
): Promise<Blob> {
  // Pre-load fonts if available in document
  if (typeof document !== "undefined" && document.fonts?.load) {
    try {
      await Promise.allSettled([
        document.fonts.load(`bold 36px ${SERIF_FONT}`),
        document.fonts.load(`bold 22px ${SANS_FONT}`),
        document.fonts.load(`bold 28px ${MONO_FONT}`),
      ]);
    } catch {
      // Graceful fallback to system fonts
    }
  }

  // Pre-load images
  let flyerPhoto: HTMLImageElement | null = null;
  if (ticket.event_image_url) {
    try {
      flyerPhoto = await loadPhoto(ticket.event_image_url);
    } catch {
      flyerPhoto = null;
    }
  }

  let qrImg: HTMLImageElement | null = null;
  if (qrDataUrl) {
    try {
      qrImg = await loadQrImage(qrDataUrl);
    } catch {
      qrImg = null;
    }
  }

  const canvas = document.createElement("canvas");
  const W = 800;
  const H = 1420;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize graphics context.");

  // 1. Transparent / dark outer canvas background
  ctx.fillStyle = "#030604";
  ctx.fillRect(0, 0, W, H);

  // 2. Main Ticket Card Container (x=24, y=24, w=752, h=1372, r=36)
  const cardX = 24;
  const cardY = 24;
  const cardW = 752;
  const cardH = 1372;
  const cardR = 36;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = "#070a08";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1c2721";
  ctx.stroke();

  // 3. Header Flyer Artwork (Top rounded corners)
  const flyerH = 420;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cardX + cardR, cardY);
  ctx.lineTo(cardX + cardW - cardR, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardR, cardR);
  ctx.lineTo(cardX + cardW, cardY + flyerH);
  ctx.lineTo(cardX, cardY + flyerH);
  ctx.lineTo(cardX, cardY + cardR);
  ctx.arcTo(cardX, cardY, cardX + cardR, cardY, cardR);
  ctx.closePath();
  ctx.clip();

  if (flyerPhoto) {
    const imgAspect = flyerPhoto.width / flyerPhoto.height;
    const targetAspect = cardW / flyerH;
    let sx = 0,
      sy = 0,
      sw = flyerPhoto.width,
      sh = flyerPhoto.height;

    if (imgAspect > targetAspect) {
      sw = flyerPhoto.height * targetAspect;
      sx = (flyerPhoto.width - sw) / 2;
    } else {
      sh = flyerPhoto.width / targetAspect;
      sy = (flyerPhoto.height - sh) / 2;
    }
    ctx.drawImage(flyerPhoto, sx, sy, sw, sh, cardX, cardY, cardW, flyerH);

    // Dark vignette gradient overlays
    const scrim = ctx.createLinearGradient(0, cardY, 0, cardY + flyerH);
    scrim.addColorStop(0, "rgba(0,0,0,0.45)");
    scrim.addColorStop(0.5, "rgba(0,0,0,0.1)");
    scrim.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = scrim;
    ctx.fillRect(cardX, cardY, cardW, flyerH);
  } else {
    // Default luxury gold & emerald ticket background
    const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + flyerH);
    grad.addColorStop(0, "#031c10");
    grad.addColorStop(0.5, "#062f1b");
    grad.addColorStop(1, "#02120b");
    ctx.fillStyle = grad;
    ctx.fillRect(cardX, cardY, cardW, flyerH);

    // Decorative ticket gold pass frame inside
    drawRoundedRect(ctx, cardX + 32, cardY + 32, cardW - 64, flyerH - 64, 24);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(234, 179, 8, 0.4)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold 32px ${SERIF_FONT}`;
    ctx.fillStyle = "rgba(254, 240, 138, 0.95)";
    ctx.fillText(ticket.event_name.toUpperCase(), W / 2, cardY + flyerH / 2 - 12);
    ctx.font = `bold 16px ${MONO_FONT}`;
    ctx.fillStyle = "rgba(234, 179, 8, 0.75)";
    ctx.fillText("★ OFFICIAL ADMISSION PASS ★", W / 2, cardY + flyerH / 2 + 30);
  }
  ctx.restore();

  // Top-Right Status Pill (VALID ENTRY)
  const isValid = ticket.status === "valid";
  const statusText = isValid ? "VALID ENTRY" : ticket.status === "checked_in" ? "CHECKED IN" : "CANCELLED";
  const statusBg = isValid ? "#059669" : ticket.status === "checked_in" ? "#d97706" : "#dc2626";

  ctx.font = `bold 18px ${SANS_FONT}`;
  const statusWidth = ctx.measureText(statusText).width + 48;
  const statusX = cardX + cardW - statusWidth - 24;
  const statusY = cardY + 24;

  drawRoundedRect(ctx, statusX, statusY, statusWidth, 42, 21);
  ctx.fillStyle = statusBg;
  ctx.fill();

  // Pulsing dot indicator
  ctx.beginPath();
  ctx.arc(statusX + 18, statusY + 21, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `bold 18px ${SANS_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(statusText, statusX + 34, statusY + 21);

  // Bottom-Left Tier Chip on Flyer
  ctx.font = `bold 20px ${SANS_FONT}`;
  const tierText = ticket.tier_name.toUpperCase();
  const tierWidth = ctx.measureText(tierText).width + 36;
  const tierX = cardX + 24;
  const tierY = cardY + flyerH - 60;

  drawRoundedRect(ctx, tierX, tierY, tierWidth, 42, 14);
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 18px ${SANS_FONT}`;
  ctx.fillStyle = "#6ee7b7";
  ctx.fillText(tierText, tierX + tierWidth / 2, tierY + 21);

  // 4. Event Title, Venue & Time Section
  let currentY = cardY + flyerH + 34;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `bold 36px ${SERIF_FONT}`;
  ctx.fillStyle = "#ffffff";

  const titleLines = wrapText(ctx, ticket.event_name, cardW - 64);
  for (const line of titleLines) {
    ctx.fillText(line, cardX + 32, currentY);
    currentY += 46;
  }

  currentY += 4;
  if (ticket.venue_name) {
    ctx.font = `bold 22px ${SANS_FONT}`;
    ctx.fillStyle = "#34d399";
    ctx.fillText("📍", cardX + 32, currentY);

    ctx.font = `600 22px ${SANS_FONT}`;
    ctx.fillStyle = "#e7e5e4";
    const venueStr = ticket.venue_address
      ? `${ticket.venue_name} (${ticket.venue_address})`
      : ticket.venue_name;
    const venueLines = wrapText(ctx, venueStr, cardW - 100);
    for (const vLine of venueLines) {
      ctx.fillText(vLine, cardX + 68, currentY);
      currentY += 30;
    }
  }

  if (ticket.doors_open_time) {
    currentY += 2;
    ctx.font = `bold 20px ${SANS_FONT}`;
    ctx.fillStyle = "#34d399";
    ctx.fillText("⏰", cardX + 32, currentY);

    ctx.font = `500 20px ${SANS_FONT}`;
    ctx.fillStyle = "#a8a29e";
    ctx.fillText("Doors open: ", cardX + 68, currentY);

    const prefixWidth = ctx.measureText("Doors open: ").width;
    ctx.font = `bold 20px ${SANS_FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ticket.doors_open_time, cardX + 68 + prefixWidth, currentY);
    currentY += 34;
  }

  // 5. Perforated Cut Line with Side Notches
  const cutY = Math.max(currentY + 24, cardY + flyerH + 195);

  // Left notch cut-out
  ctx.beginPath();
  ctx.arc(cardX, cutY, 18, -Math.PI / 2, Math.PI / 2);
  ctx.fillStyle = "#030604";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1c2721";
  ctx.stroke();

  // Right notch cut-out
  ctx.beginPath();
  ctx.arc(cardX + cardW, cutY, 18, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.fillStyle = "#030604";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1c2721";
  ctx.stroke();

  // Dashed tear line across middle
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#292524";
  ctx.beginPath();
  ctx.moveTo(cardX + 34, cutY);
  ctx.lineTo(cardX + cardW - 34, cutY);
  ctx.stroke();
  ctx.restore();

  // 6. Ticket Holder & CODE PAX Section
  const infoY = cutY + 36;

  // Left: Ticket Holder Info
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `bold 16px ${SANS_FONT}`;
  ctx.fillStyle = "#78716c";
  ctx.fillText("TICKET HOLDER", cardX + 32, infoY);

  ctx.font = `bold 28px ${SANS_FONT}`;
  ctx.fillStyle = "#ffffff";
  const nameLine = ticket.customer_name.length > 22
    ? ticket.customer_name.slice(0, 20) + "..."
    : ticket.customer_name;
  ctx.fillText(nameLine, cardX + 32, infoY + 26);

  ctx.font = `bold 19px ${SANS_FONT}`;
  ctx.fillStyle = "#34d399";
  const qtyStr = `${ticket.quantity} ${ticket.quantity === 1 ? "Person" : "Persons"} (${ticket.tier_name})`;
  ctx.fillText(qtyStr, cardX + 32, infoY + 64);

  // Right: CODE PAX Pill
  ctx.textAlign = "right";
  ctx.font = `bold 16px ${SANS_FONT}`;
  ctx.fillStyle = "#10b981";
  ctx.fillText("VERIFICATION", cardX + cardW - 32, infoY);

  ctx.font = `bold 26px ${MONO_FONT}`;
  const paxText = ticket.pax_code;
  const paxWidth = ctx.measureText(paxText).width + 36;
  const paxX = cardX + cardW - 32 - paxWidth;
  const paxY = infoY + 28;

  drawRoundedRect(ctx, paxX, paxY, paxWidth, 50, 16);
  ctx.fillStyle = "#0f281b";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 26px ${MONO_FONT}`;
  ctx.fillStyle = "#a7f3d0";
  ctx.fillText(paxText, paxX + paxWidth / 2, paxY + 25);

  // 7. QR Code Card Container
  const qrCardY = infoY + 115;
  const qrCardH = 430;
  const qrCardW = cardW - 64;
  const qrCardX = cardX + 32;

  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardW, qrCardH, 24);
  ctx.fillStyle = "#0c100e";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1c2721";
  ctx.stroke();

  // White square plate for QR Code
  const qrPlateSize = 270;
  const qrPlateX = (W - qrPlateSize) / 2;
  const qrPlateY = qrCardY + 28;

  drawRoundedRect(ctx, qrPlateX, qrPlateY, qrPlateSize, qrPlateSize, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  if (qrImg) {
    const qrImgSize = 250;
    const qrImgOffset = (qrPlateSize - qrImgSize) / 2;
    ctx.drawImage(qrImg, qrPlateX + qrImgOffset, qrPlateY + qrImgOffset, qrImgSize, qrImgSize);
  }

  // Instructions below QR Code
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `600 20px ${SANS_FONT}`;
  ctx.fillStyle = "#d6d3d1";
  ctx.fillText(`Show this QR code or mention ${ticket.pax_code} at the gate.`, W / 2, qrPlateY + qrPlateSize + 22);

  ctx.font = `500 16px ${SANS_FONT}`;
  ctx.fillStyle = "#78716c";
  ctx.fillText("Valid for entry · Scanned instantly by gate ushers", W / 2, qrPlateY + qrPlateSize + 54);

  // 8. Brand Security Footer
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 14px ${SANS_FONT}`;
  ctx.fillStyle = "#57534e";
  const refText = ticket.order_reference ? ` · REF: ${ticket.order_reference}` : "";
  ctx.fillText(`VOTECASTHUB GH · OFFICIAL DIGITAL ENTRANCE PASS${refText}`, W / 2, cardY + cardH - 32);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export ticket pass image blob."));
    }, "image/png");
  });
}

export async function saveTicketAsImage(
  ticket: TicketPassData,
  qrDataUrl: string
): Promise<void> {
  const blob = await generateTicketImageBlob(ticket, qrDataUrl);
  const fileName = `votecasthub-ticket-${ticket.pax_code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  // On modern mobile devices (iOS Safari / Android Chrome), use Web Share API
  // which brings up native "Save Image" to Photos or share via WhatsApp!
  if (typeof navigator !== "undefined" && navigator.canShare) {
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${ticket.event_name} Ticket (${ticket.pax_code})`,
          text: `My entry ticket for ${ticket.event_name} - CODE PAX: ${ticket.pax_code}`,
        });
        return;
      } catch (err: unknown) {
        // User cancelled share sheet or share dismissed: fallback to direct download below
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
      }
    }
  }

  // Desktop or fallback direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
