#!/usr/bin/env node
/**
 * Deterministic local link checker.
 *
 * Why not a generic HTTP link checker? This site is case-sensitive on
 * GitHub Pages/Linux but case-insensitive on macOS, and an HTTP-based checker
 * running locally would silently accept `liveStock.html` vs `livestock.html`.
 * Comparing against the real file listing keeps the check identical on every
 * operating system.
 *
 * Checks:
 *   - every local href/src target exists with exact filename casing
 *   - every #fragment points at an existing id/name in the target HTML
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(projectRoot, "public");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blankOut(text) {
  return text.replace(/[^\n]/g, " ");
}

/**
 * Ignore HTML comments and the *contents* of <script>/<style> blocks.
 * Opening tags are preserved so `<script src="config.js">` is still checked.
 * This intentionally makes the checker a markup-link checker: navigation
 * strings inside JavaScript (including commented-out code) are not URLs the
 * browser resolves as links.
 */
function markupOnly(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, blankOut)
    .replace(
      /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
      (_, open, body, close) => open + blankOut(body) + close,
    )
    .replace(
      /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (_, open, body, close) => open + blankOut(body) + close,
    );
}

function hasAnchor(html, fragment) {
  const id = escapeRegExp(fragment);
  return new RegExp(`(?:\\bid|\\bname)\\s*=\\s*["']${id}["']`).test(html);
}

const files = walk(publicDir);
const fileSet = new Set(
  files.map((file) => relative(publicDir, file).split(sep).join("/")),
);
const htmlFiles = files.filter((file) => file.endsWith(".html"));

// Matches href/src with single or double quotes.
const ATTR_RE = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
// Any explicit scheme (http:, mailto:, tel:, data:, ...) or protocol-relative URL.
const HAS_SCHEME_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

let checked = 0;
let failures = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const markup = markupOnly(html);
  const sourceRel = relative(publicDir, file).split(sep).join("/");

  for (const match of markup.matchAll(ATTR_RE)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    if (!value || HAS_SCHEME_RE.test(value)) continue;

    const line = markup.slice(0, match.index).split("\n").length;

    // Same-page fragment: href="#section"
    if (value.startsWith("#")) {
      if (value.length > 1 && !hasAnchor(html, decodeURIComponent(value.slice(1)))) {
        failures += 1;
        console.error(`${sourceRel}:${line}  missing same-page anchor -> ${value}`);
      }
      continue;
    }

    checked += 1;

    let [pathPart, fragment = ""] = value.split("#");
    pathPart = pathPart.split("?")[0];

    let cleanPath;
    try {
      cleanPath = decodeURIComponent(pathPart);
    } catch {
      failures += 1;
      console.error(`${sourceRel}:${line}  malformed URL encoding -> ${value}`);
      continue;
    }

    if (!cleanPath) continue; // e.g. "?page=2" with no path

    const targetPath = cleanPath.startsWith("/")
      ? resolve(publicDir, cleanPath.slice(1))
      : resolve(dirname(file), cleanPath);
    const targetRel = relative(publicDir, targetPath).split(sep).join("/");

    if (targetRel.startsWith("..") || !fileSet.has(targetRel)) {
      failures += 1;
      console.error(`${sourceRel}:${line}  broken reference -> ${value}`);
      continue;
    }

    if (fragment && targetRel.endsWith(".html")) {
      const targetHtml = readFileSync(join(publicDir, targetRel), "utf8");
      if (!hasAnchor(targetHtml, decodeURIComponent(fragment))) {
        failures += 1;
        console.error(`${sourceRel}:${line}  missing anchor -> ${value}`);
      }
    }
  }
}

console.log(
  `Checked ${checked} local reference(s) across ${htmlFiles.length} HTML file(s).`,
);

if (failures > 0) {
  console.error(`\n${failures} broken reference(s) found.`);
  process.exit(1);
}

console.log("All local references resolve.");
