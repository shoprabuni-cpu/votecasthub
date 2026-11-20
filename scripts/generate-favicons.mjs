import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

async function run() {
  const source = "public/images/votecasthub-logo.png";
  if (!fs.existsSync(source)) {
    console.error("Source logo not found:", source);
    process.exit(1);
  }

  // Emblem bounding box in 1536x1024:
  // left: 98, top: 262, width: 437, height: 426
  const emblem = await sharp(source)
    .extract({ left: 98, top: 262, width: 437, height: 426 })
    .toBuffer();

  // Create master 512x512 with safe padding (emblem scaled to 420x410)
  const masterSize = 512;
  const targetW = 420;
  const targetH = Math.round(420 * (426 / 437)); // 409
  const left = Math.round((masterSize - targetW) / 2);
  const top = Math.round((masterSize - targetH) / 2);

  const resizedEmblem = await sharp(emblem)
    .resize(targetW, targetH, { fit: "contain" })
    .toBuffer();

  const master512 = await sharp({
    create: {
      width: masterSize,
      height: masterSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedEmblem, left, top }])
    .png()
    .toBuffer();

  // Ensure directories exist
  if (!fs.existsSync("public/icons")) fs.mkdirSync("public/icons", { recursive: true });
  if (!fs.existsSync("src/app")) fs.mkdirSync("src/app", { recursive: true });

  // 1. public/icons/icon-512.png
  await sharp(master512).toFile("public/icons/icon-512.png");
  console.log("Created public/icons/icon-512.png");

  // 2. src/app/icon.png (Next.js official root icon)
  await sharp(master512).toFile("src/app/icon.png");
  console.log("Created src/app/icon.png");

  // 3. public/icons/icon-192.png
  await sharp(master512).resize(192, 192).toFile("public/icons/icon-192.png");
  console.log("Created public/icons/icon-192.png");

  // 4. public/icons/icon-96.png (Multiple of 48)
  await sharp(master512).resize(96, 96).toFile("public/icons/icon-96.png");
  console.log("Created public/icons/icon-96.png");

  // 5. public/icons/icon-48.png (Google Search standard multiple of 48)
  await sharp(master512).resize(48, 48).toFile("public/icons/icon-48.png");
  console.log("Created public/icons/icon-48.png");

  // 6. public/icons/apple-touch-icon.png (180x180)
  await sharp(master512).resize(180, 180).toFile("public/icons/apple-touch-icon.png");
  console.log("Created public/icons/apple-touch-icon.png");

  // 7. src/app/apple-icon.png (Next.js official root apple touch icon)
  await sharp(master512).resize(180, 180).toFile("src/app/apple-icon.png");
  console.log("Created src/app/apple-icon.png");

  // 8. public/favicon.ico (Google Search direct favicon fetch fallback, 48x48 PNG format inside ICO or 48x48 PNG renamed as ICO)
  // Generating a standard 48x48 ICO file header + PNG payload
  const png48 = await sharp(master512).resize(48, 48).png().toBuffer();
  // Valid ICO file wrapping a PNG payload
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // 1 image

  const icoDirEntry = Buffer.alloc(16);
  icoDirEntry.writeUInt8(48, 0); // Width 48
  icoDirEntry.writeUInt8(48, 1); // Height 48
  icoDirEntry.writeUInt8(0, 2);  // Color count
  icoDirEntry.writeUInt8(0, 3);  // Reserved
  icoDirEntry.writeUInt16LE(1, 4); // Color planes
  icoDirEntry.writeUInt16LE(32, 6); // Bits per pixel
  icoDirEntry.writeUInt32LE(png48.length, 8); // Size of image data
  icoDirEntry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

  const icoBuffer = Buffer.concat([icoHeader, icoDirEntry, png48]);
  fs.writeFileSync("public/favicon.ico", icoBuffer);
  fs.writeFileSync("src/app/favicon.ico", icoBuffer);
  console.log("Created public/favicon.ico and src/app/favicon.ico");
}

run().catch(console.error);
