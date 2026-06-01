const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "../uploads/hotels");
const CHAMBRE_UPLOAD_ROOT = path.join(__dirname, "../uploads/chambres");
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], "base64") };
}

function parseBase64Payload(body) {
  if (body.dataUrl) {
    return parseDataUrl(body.dataUrl);
  }

  if (body.imageBase64) {
    const mime = (body.mimeType || "image/jpeg").toLowerCase();
    const raw = body.imageBase64.replace(/^data:[^;]+;base64,/, "");
    return { mime, buffer: Buffer.from(raw, "base64") };
  }

  return null;
}

function validateImageBuffer(buffer, mime) {
  if (!buffer || !buffer.length) {
    return "Image vide";
  }

  if (buffer.length > MAX_BYTES) {
    return "Image trop volumineuse (max 5 Mo)";
  }

  if (!MIME_EXT[mime]) {
    return "Format non autorisé (JPEG, PNG, WebP, GIF)";
  }

  return null;
}

function absFromRel(relPath) {
  return path.join(__dirname, "..", relPath.replace(/^\//, ""));
}

function deleteRelFile(relPath) {
  if (!relPath) return;
  const abs = absFromRel(relPath);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

function saveHotelImage(hotelId, body, prefix) {
  const parsed = parseBase64Payload(body);
  if (!parsed) {
    throw new Error("Image invalide");
  }

  const errMsg = validateImageBuffer(parsed.buffer, parsed.mime);
  if (errMsg) {
    throw new Error(errMsg);
  }

  const ext = MIME_EXT[parsed.mime];
  const dir = path.join(UPLOAD_ROOT, String(hotelId));
  ensureDir(dir);

  const filename = `${prefix}-${Date.now()}${ext}`;
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, parsed.buffer);

  return `/uploads/hotels/${hotelId}/${filename}`;
}

function saveChambreImage(chambreId, body, prefix) {
  const parsed = parseBase64Payload(body);
  if (!parsed) {
    throw new Error("Image invalide");
  }

  const errMsg = validateImageBuffer(parsed.buffer, parsed.mime);
  if (errMsg) {
    throw new Error(errMsg);
  }

  const ext = MIME_EXT[parsed.mime];
  const dir = path.join(CHAMBRE_UPLOAD_ROOT, String(chambreId));
  ensureDir(dir);

  const filename = `${prefix}-${Date.now()}${ext}`;
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, parsed.buffer);

  return `/uploads/chambres/${chambreId}/${filename}`;
}

module.exports = {
  saveHotelImage,
  saveChambreImage,
  deleteRelFile,
  parseBase64Payload,
  validateImageBuffer,
  MAX_BYTES,
  MIME_EXT
};
