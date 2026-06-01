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

function isPublicHtml(filePath) {
  return filePath.replace(/\\/g, "/").includes("/Public/html/");
}

function injectHtml(html, assetVersion, filePath) {
  let versioned = html.replace(
    /((?:href|src)\s*=\s*["'])([^"']+\.(?:css|js))(?:\?[^"']*)?(["'])/gi,
    (_, prefix, url, suffix) => `${prefix}${url}?v=${assetVersion}${suffix}`
  );

  const metaTags = [
    `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`,
    `<meta http-equiv="Pragma" content="no-cache">`,
    `<meta http-equiv="Expires" content="0">`,
    `<meta name="hf-build" content="${assetVersion}">`
  ].join("");

  let headInject = metaTags;

  if (isPublicHtml(filePath)) {
    headInject += `<script>window.__HF_BUILD="${assetVersion}";</script>`;
    headInject += `<script src="/Commun/publicFreshLoad.js?v=${assetVersion}"></script>`;
  }

  if (versioned.includes("<head>")) {
    versioned = versioned.replace("<head>", `<head>${headInject}`);
  }

  return versioned;
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

      res.type("html").send(injectHtml(html, assetVersion, filePath));
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
