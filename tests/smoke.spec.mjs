import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const pages = readdirSync(publicDir)
  .filter((file) => file.endsWith(".html"))
  .sort();

/**
 * Smoke tests run against every HTML page discovered in public/.
 * New pages are covered automatically; no test list needs updating.
 */
for (const file of pages) {
  test(`${file} loads without runtime or asset errors`, async ({
    page,
    baseURL,
  }) => {
    const pageErrors = [];
    const failedLocalRequests = [];

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(baseURL) && response.status() >= 400) {
        failedLocalRequests.push(
          `${response.status()} ${response.url().replace(baseURL, "")}`,
        );
      }
    });

    const response = await page.goto(`/${file}`, { waitUntil: "load" });

    expect(response, `No HTTP response for ${file}`).not.toBeNull();
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator("body")).not.toBeEmpty();

    expect(pageErrors, `Uncaught errors on ${file}`).toEqual([]);
    expect(
      failedLocalRequests,
      `Failed local resources on ${file}`,
    ).toEqual([]);
  });
}
