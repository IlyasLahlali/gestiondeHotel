const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value !== "" || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

// dotenv npm (si installé)
try {
  require("dotenv").config({ path: envPath });
} catch (_) {
  /* optionnel */
}

function readGoogleClientIdFromConfigJs() {
  try {
    const configJs = path.join(
      __dirname,
      "..",
      "..",
      "frontend",
      "Commun",
      "google-config.js"
    );
    const content = fs.readFileSync(configJs, "utf8");
    const m = content.match(
      /GOOGLE_CLIENT_ID\s*=\s*["']([^"']+)["']/
    );
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

const googleFromEnv = (process.env.GOOGLE_CLIENT_ID || "").trim();
const googleFromJs = readGoogleClientIdFromConfigJs();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || "SECRET_KEY",
  GOOGLE_CLIENT_ID: googleFromEnv || googleFromJs,
  PORT: process.env.PORT || 3000
};
