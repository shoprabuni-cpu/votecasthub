import { eventPresentation, ghanaDate } from "./presentation";

export type FlyerDetails = {
  ussd?: { event_code: number; dial_code: string; network_notice: string };
  nominee?: string;
  category?: string;
  imageUrl?: string | null;
  eventName?: string;
  code?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  votingMode?: "free" | "paid";
  unitPriceMinor?: number;
  eventCode?: string;
};

const SERIF_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS_FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_FONT = "'Space Grotesk', 'Courier New', monospace";
const WA_DISPLAY = "+233 59 299 2566";

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
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Photo unavailable");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > 12 * 1024 * 1024) throw new Error("Invalid image format");
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

export async function createFlyer(title: string, url: string, detail: FlyerDetails) {
  // Try loading web fonts if available in document
  if (typeof document !== "undefined" && document.fonts?.load) {
    try {
      await Promise.allSettled([
        document.fonts.load(`bold 32px ${SERIF_FONT}`),
        document.fonts.load(`bold 22px ${SANS_FONT}`),
        document.fonts.load(`bold 16px ${MONO_FONT}`),
      ]);
    } catch {
      // Graceful fallback to system fonts
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350; // Standard 4:5 portrait ratio (Instagram / WhatsApp Status)
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create a flyer.");

  const eventCode = detail.eventCode || (detail.ussd?.event_code ? String(detail.ussd.event_code) : "VOTE");
  const nomineeCode = detail.code ? String(detail.code) : "";
  const hasUssd = Boolean(detail.ussd && detail.ussd.dial_code && detail.ussd.event_code);

  // 1. BASE BACKGROUND & LUXURY LIGHTING
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1350);
  bgGrad.addColorStop(0, "#0a1c15");
  bgGrad.addColorStop(0.45, "#07130e");
  bgGrad.addColorStop(1, "#040907");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1350);

  // Subtle Ambient Glows
  const goldGlow = ctx.createRadialGradient(920, 120, 10, 920, 120, 380);
  goldGlow.addColorStop(0, "rgba(223, 177, 91, 0.12)");
  goldGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = goldGlow;
  ctx.fillRect(500, 0, 580, 500);

  const emeraldGlow = ctx.createRadialGradient(120, 680, 10, 120, 680, 420);
  emeraldGlow.addColorStop(0, "rgba(16, 185, 129, 0.08)");
  emeraldGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = emeraldGlow;
  ctx.fillRect(0, 300, 550, 750);

  // Double Inset Hairline Frame
  drawRoundedRect(ctx, 28, 28, 1024, 1294, 26);
  ctx.strokeStyle = "rgba(223, 177, 91, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawRoundedRect(ctx, 36, 36, 1008, 1278, 20);
  ctx.strokeStyle = "rgba(223, 177, 91, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 2. TOP HEADER: Brand & Event Title
  // Eyebrow Brand
  ctx.textAlign = "center";
  ctx.font = `bold 15px ${MONO_FONT}`;
  ctx.fillStyle = "#dfb15b";
  ctx.fillText("VOTECASTHUB  GH", 540, 72);

  // Decorative header lines
  const lineGradL = ctx.createLinearGradient(330, 67, 430, 67);
  lineGradL.addColorStop(0, "rgba(223, 177, 91, 0)");
  lineGradL.addColorStop(1, "rgba(223, 177, 91, 0.8)");
  ctx.strokeStyle = lineGradL;
  ctx.beginPath();
  ctx.moveTo(330, 67);
  ctx.lineTo(430, 67);
  ctx.stroke();

  const lineGradR = ctx.createLinearGradient(650, 67, 750, 67);
  lineGradR.addColorStop(0, "rgba(223, 177, 91, 0.8)");
  lineGradR.addColorStop(1, "rgba(223, 177, 91, 0)");
  ctx.strokeStyle = lineGradR;
  ctx.beginPath();
  ctx.moveTo(650, 67);
  ctx.lineTo(750, 67);
  ctx.stroke();

  // Event Title
  const eventName = detail.eventName || title;
  ctx.font = `bold 30px ${SERIF_FONT}`;
  ctx.fillStyle = "#ffffff";
  const eventTitleLines = wrapText(ctx, eventName, 900).slice(0, 2);
  eventTitleLines.forEach((l, i) => {
    ctx.fillText(l, 540, 114 + i * 36);
  });

  // Category Badge Pill
  const categoryTitle = `★ ${(detail.category || "OFFICIAL NOMINEE").toUpperCase()} ★`;
  ctx.font = `bold 14px ${SANS_FONT}`;
  const catWidth = Math.min(ctx.measureText(categoryTitle).width + 36, 850);
  const catY = eventTitleLines.length > 1 ? 190 : 162;

  drawRoundedRect(ctx, 540 - catWidth / 2, catY - 16, catWidth, 28, 14);
  ctx.fillStyle = "rgba(223, 177, 91, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(223, 177, 91, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#fce08a";
  ctx.fillText(categoryTitle, 540, catY + 4);

  // 3. NOMINEE HERO PHOTO (Framed Luxury Showcase)
  const photoBoxW = 460;
  const photoBoxH = 470;
  const photoBoxX = (1080 - photoBoxW) / 2;
  const photoBoxY = catY + 32;

  // Outer ambient shadow
  ctx.save();
  drawRoundedRect(ctx, photoBoxX, photoBoxY, photoBoxW, photoBoxH, 24);
  ctx.fillStyle = "#0c1f17";
  ctx.fill();

  let photoLoaded = false;
  if (detail.imageUrl) {
    try {
      const img = await loadPhoto(detail.imageUrl);
      ctx.save();
      drawRoundedRect(ctx, photoBoxX, photoBoxY, photoBoxW, photoBoxH, 24);
      ctx.clip();

      // Cover scaling
      const scale = Math.max(photoBoxW / img.width, photoBoxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = photoBoxX + (photoBoxW - w) / 2;
      const y = photoBoxY + (photoBoxH - h) / 2;
      ctx.drawImage(img, x, y, w, h);

      // Subtle bottom vignette inside photo
      const photoVignette = ctx.createLinearGradient(0, photoBoxY + photoBoxH - 120, 0, photoBoxY + photoBoxH);
      photoVignette.addColorStop(0, "rgba(0,0,0,0)");
      photoVignette.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = photoVignette;
      ctx.fillRect(photoBoxX, photoBoxY + photoBoxH - 120, photoBoxW, 120);

      ctx.restore();
      photoLoaded = true;
    } catch {
      // Graceful fallback below
    }
  }

  if (!photoLoaded) {
    // Luxury Monogram Seal Fallback
    ctx.save();
    drawRoundedRect(ctx, photoBoxX, photoBoxY, photoBoxW, photoBoxH, 24);
    ctx.clip();
    const sealGrad = ctx.createRadialGradient(540, photoBoxY + photoBoxH / 2, 20, 540, photoBoxY + photoBoxH / 2, 220);
    sealGrad.addColorStop(0, "#194230");
    sealGrad.addColorStop(1, "#0a1f16");
    ctx.fillStyle = sealGrad;
    ctx.fillRect(photoBoxX, photoBoxY, photoBoxW, photoBoxH);

    ctx.strokeStyle = "rgba(223, 177, 91, 0.35)";
    ctx.lineWidth = 1.5;
    for (const r of [80, 120, 160]) {
      ctx.beginPath();
      ctx.arc(540, photoBoxY + photoBoxH / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = `bold 120px ${SERIF_FONT}`;
    ctx.fillStyle = "#dfb15b";
    ctx.textAlign = "center";
    ctx.fillText((detail.nominee || title).trim().slice(0, 1).toUpperCase(), 540, photoBoxY + photoBoxH / 2 + 42);
    ctx.restore();
  }

  // Draw 2px gold frame around photo
  drawRoundedRect(ctx, photoBoxX, photoBoxY, photoBoxW, photoBoxH, 24);
  ctx.strokeStyle = "rgba(223, 177, 91, 0.75)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 4. CONTESTANT NAME & PROMINENT VOTING CODE BADGE
  const nameY = photoBoxY + photoBoxH + 46;
  ctx.font = `bold 42px ${SERIF_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const nomineeDisplayName = detail.nominee || title;
  ctx.fillText(nomineeDisplayName, 540, nameY);

  // High-Contrast Metallic Gold Code Pill
  const codeBadgeY = nameY + 20;
  if (nomineeCode) {
    const badgeText = `VOTING CODE:  ${nomineeCode}`;
    ctx.font = `bold 20px ${MONO_FONT}`;
    const badgeW = ctx.measureText(badgeText).width + 56;
    const badgeH = 46;

    drawRoundedRect(ctx, 540 - badgeW / 2, codeBadgeY, badgeW, badgeH, 14);
    ctx.fillStyle = "#dfb15b";
    ctx.fill();
    ctx.strokeStyle = "#fce08a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#0c0a06";
    ctx.fillText(badgeText, 540, codeBadgeY + 30);
  } else {
    const badgeText = "OFFICIAL CANDIDATE";
    ctx.font = `bold 16px ${MONO_FONT}`;
    const badgeW = ctx.measureText(badgeText).width + 48;
    drawRoundedRect(ctx, 540 - badgeW / 2, codeBadgeY, badgeW, 40, 12);
    ctx.fillStyle = "rgba(223, 177, 91, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#dfb15b";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#fce08a";
    ctx.fillText(badgeText, 540, codeBadgeY + 25);
  }

  // 5. MULTI-CHANNEL VOTING INSTRUCTIONS CARD
  const cardX = 46;
  const cardY = codeBadgeY + 68;
  const cardW = 988;
  const cardH = 1350 - cardY - 44;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.fillStyle = "rgba(4, 12, 9, 0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Card Header
  ctx.font = `bold 12px ${SANS_FONT}`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#9ca3af";
  ctx.fillText("HOW TO CAST YOUR VOTE:", cardX + 24, cardY + 28);

  ctx.textAlign = "right";
  ctx.fillStyle = "#34d399";
  ctx.fillText("VOTING IS LIVE", cardX + cardW - 24, cardY + 28);

  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 40);
  ctx.lineTo(cardX + cardW - 24, cardY + 40);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.stroke();

  // QR Code on right side
  const qrBoxW = 140;
  const qrBoxH = 155;
  const qrBoxX = cardX + cardW - qrBoxW - 24;
  const qrBoxY = cardY + 54;

  let qrLoaded = false;
  try {
    const qrImg = await loadPhoto(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`);
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.drawImage(qrImg, qrBoxX + 10, qrBoxY + 10, 120, 120);

    ctx.textAlign = "center";
    ctx.font = `800 9px ${MONO_FONT}`;
    ctx.fillStyle = "#111827";
    ctx.fillText("SCAN TO VOTE", qrBoxX + qrBoxW / 2, qrBoxY + 144);
    qrLoaded = true;
  } catch {
    // If QR fetch fails, we skip and use full width
  }

  const channelsW = qrLoaded ? cardW - qrBoxW - 68 : cardW - 48;
  const channelsX = cardX + 24;
  let currentChannelY = cardY + 54;

  // Channel 1: WhatsApp Bot (100% Free · Always Active)
  const waBoxH = 68;
  drawRoundedRect(ctx, channelsX, currentChannelY, channelsW, waBoxH, 14);
  ctx.fillStyle = "rgba(6, 78, 59, 0.6)";
  ctx.fill();
  ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `bold 14px ${SANS_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("💬 WhatsApp Bot (100% Free · No SMS needed)", channelsX + 16, currentChannelY + 24);

  ctx.font = `bold 13px ${MONO_FONT}`;
  ctx.fillStyle = "#a7f3d0";
  const waCommand = nomineeCode ? `VOTE ${eventCode} ${nomineeCode}` : `VOTE ${eventCode}`;
  ctx.fillText(`Send "${waCommand}" to ${WA_DISPLAY}`, channelsX + 16, currentChannelY + 48);

  currentChannelY += waBoxH + 10;

  // Channel 2: USSD Dialing (CONDITIONAL! Only rendered if approved & active)
  if (hasUssd && detail.ussd) {
    const ussdBoxH = 64;
    drawRoundedRect(ctx, channelsX, currentChannelY, channelsW, ussdBoxH, 14);
    ctx.fillStyle = "rgba(35, 26, 10, 0.65)";
    ctx.fill();
    ctx.strokeStyle = "rgba(217, 119, 6, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `bold 13px ${SANS_FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("📞 USSD Dialing (No Internet needed)", channelsX + 16, currentChannelY + 22);

    ctx.font = `bold 13px ${MONO_FONT}`;
    ctx.fillStyle = "#fde68a";
    const ussdDetail = nomineeCode
      ? `Dial ${detail.ussd.dial_code} · Event: ${detail.ussd.event_code} · Code: ${nomineeCode}`
      : `Dial ${detail.ussd.dial_code} · Event Code: ${detail.ussd.event_code}`;
    ctx.fillText(ussdDetail, channelsX + 16, currentChannelY + 46);

    currentChannelY += ussdBoxH + 10;
  }

  // Channel 3: Official Web Link
  ctx.textAlign = "left";
  ctx.font = `600 13px ${SANS_FONT}`;
  ctx.fillStyle = "#9ca3af";
  const cleanUrl = url.replace(/^https?:\/\//, "");
  ctx.fillText(`🌐 Official Web Ballot: `, channelsX + 4, currentChannelY + 16);
  ctx.font = `bold 13px ${MONO_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(cleanUrl, channelsX + 164, currentChannelY + 16);

  // Footer Timing & Details
  const state = detail.startsAt && detail.endsAt
    ? eventPresentation({ status: detail.status || "published", starts_at: detail.startsAt, ends_at: detail.endsAt })
    : null;

  const closesDate = detail.endsAt ? `Closes ${ghanaDate(detail.endsAt)}` : "";
  const pricingNote = detail.votingMode === "paid"
    ? ` · GH₵ ${((detail.unitPriceMinor ?? 100) / 100).toFixed(2)}/vote (MoMo)`
    : " · Free Voting";

  ctx.textAlign = "center";
  ctx.font = `11px ${SANS_FONT}`;
  ctx.fillStyle = "#6b7280";
  ctx.fillText(
    `Voting Deadline: ${closesDate} · Ghana Time${pricingNote} · Powered by VoteCastHub`,
    cardX + cardW / 2,
    cardY + cardH - 12
  );

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The flyer could not be created. Please try again.");
  return { blob, photoMissing: Boolean(detail.imageUrl && !photoLoaded) };
}
