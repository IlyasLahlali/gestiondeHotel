const fs = require("fs");
const path = require("path");
const express = require("express");

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0"
};

function resolveAssetVersion() {
  const raw =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.ASSET_VERSION ||
    "dev";
  return String(raw).slice(0, 12);
}

function injectAssetVersion(html, assetVersion) {
  return html.replace(
    /((?:href|src)\s*=\s*["'])([^"']+\.(?:css|js))(?:\?[^"']*)?(["'])/gi,
    (_, prefix, url, suffix) => `${prefix}${url}?v=${assetVersion}${suffix}`
  );
}

function resolveHtmlPath(frontendPath, urlPath) {
  const cleanPath = urlPath.split("?")[0].split("#")[0];
  if (!cleanPath.endsWith(".html")) return null;

  const relativePath = cleanPath.replace(/^\/+/, "");
  const resolved = path.resolve(frontendPath, relativePath);
  const normalizedRoot = path.resolve(frontendPath);

  if (!resolved.startsWith(normalizedRoot)) return null;
  return resolved;
}

function createFrontendStaticMiddleware(frontendPath) {
  const assetVersion = resolveAssetVersion();
  const normalizedRoot = path.resolve(frontendPath);

  console.log(`Frontend asset version: ${assetVersion}`);

  const htmlMiddleware = (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const filePath = resolveHtmlPath(normalizedRoot, req.path);
    if (!filePath || !fs.existsSync(filePath)) return next();

    fs.readFile(filePath, "utf8", (err, html) => {
      if (err) return next();

      Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      if (req.method === "HEAD") {
        res.type("html").end();
        return;
      }

      res.type("html").send(injectAssetVersion(html, assetVersion));
    });
  };

  const staticMiddleware = express.static(normalizedRoot, {
    etag: false,
    lastModified: false,
    index: false,
    setHeaders(res, filePath) {
      if (/\.(css|js)$/i.test(filePath)) {
        Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
    }
  });

  return { htmlMiddleware, staticMiddleware, assetVersion };
}

module.exports = {
  createFrontendStaticMiddleware,
  resolveAssetVersion
};
