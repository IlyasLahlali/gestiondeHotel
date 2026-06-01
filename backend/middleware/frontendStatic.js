const fs = require("fs");
const path = require("path");
const express = require("express");

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store"
};

function resolveAssetVersion() {
  const raw =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.ASSET_VERSION ||
    "dev";
  return String(raw).slice(0, 12);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function injectAssetVersion(html, assetVersion) {
  const metaTags = [
    `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`,
    `<meta http-equiv="Pragma" content="no-cache">`,
    `<meta http-equiv="Expires" content="0">`,
    `<meta name="hf-build" content="${assetVersion}">`
  ].join("");

  const reloadGuard = `<script>(function(){var v="${assetVersion}",k="hf_build";try{var p=localStorage.getItem(k);if(p===v)return;localStorage.setItem(k,v);if(location.search.indexOf("hf="+v)<0){var u=new URL(location.href);u.searchParams.set("hf",v);location.replace(u.toString());}}catch(e){}})();</script>`;

  let versioned = html.replace(
    /((?:href|src)\s*=\s*["'])([^"']+\.(?:css|js))(?:\?[^"']*)?(["'])/gi,
    (_, prefix, url, suffix) => `${prefix}${url}?v=${assetVersion}${suffix}`
  );

  if (versioned.includes("<head>")) {
    versioned = versioned.replace("<head>", `<head>${reloadGuard}${metaTags}`);
  } else {
    versioned = reloadGuard + metaTags + versioned;
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

      const cookies = parseCookies(req);
      if (cookies.hf_cache_cleared !== assetVersion) {
        res.setHeader("Clear-Site-Data", '"cache"');
        res.append(
          "Set-Cookie",
          `hf_cache_cleared=${assetVersion}; Path=/; Max-Age=31536000; SameSite=Lax`
        );
      }

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
