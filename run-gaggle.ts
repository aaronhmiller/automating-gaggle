import puppeteer from "https://deno.land/x/puppeteer/mod.ts";
import { load } from "https://deno.land/std/dotenv/mod.ts";

const env = await load();

// Function to generate a random delay between min and max milliseconds
function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Function to perform an action with a random delay before and after
async function performActionWithDelay(
  page: puppeteer.Page,
  action: () => Promise<void>,
) {
  await page.waitForTimeout(randomDelay(500, 1500));
  await action();
  await page.waitForTimeout(randomDelay(500, 1500));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--window-size=2200,1000"],
  });

  const page = (await browser.pages())[0];
  await page.setViewport({ width: 2200, height: 1000 });

  try {
    await page.goto("https://accounts.gaggleamp.com/sign_in", {
      waitUntil: "networkidle0",
      timeout: 60000, // Increase timeout to 60 seconds
    });

    // Wait for email input field to be visible
    await page.waitForSelector("#user_email", { visible: true, timeout: 1000 });

    const usr = env.USR;
    await page.type("#user_email", usr);

    await performActionWithDelay(page, async () => {
      await page.waitForSelector("#continue-button", {
        visible: true,
        timeout: 1000,
      });
      await page.click("#continue-button");
    });

    await page.waitForSelector("#user_password", {
      visible: true,
      timeout: 1000,
    });
    const pwd = env.PWD;

    await performActionWithDelay(page, async () => {
      await page.type("#user_password", pwd);
      await page.click('input[type="submit"]');
    });

    // Wait for the logout button to appear, indicating successful login
    await page.waitForSelector(".ga3-recommended-channels__title", {
      visible: true,
      timeout: 60000,
    });

    console.log("Login successful!");

    // Optional: Take a screenshot of the logged-in page
    await page.screenshot({ path: "logged-in-screenshot.png" });
  } catch (error) {
    console.error("An error occurred:", error);

    // Optional: Take a screenshot when an error occurs
    await page.screenshot({ path: "error-screenshot.png" });
  } finally {
    await browser.close();
  }
})();
