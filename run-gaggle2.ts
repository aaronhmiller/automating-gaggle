import { firefox, type Page } from "npm:playwright";
import { load } from "https://deno.land/std/dotenv/mod.ts";

const env = await load();

// Function to generate a random delay between min and max milliseconds
function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Function to perform an action with a random delay before and after
async function performActionWithDelay(
  page: Page,
  action: () => Promise<void>,
) {
  await page.waitForTimeout(randomDelay(500, 1500));
  await action();
  await page.waitForTimeout(randomDelay(500, 1500));
}

async function checkForActivities(page: Page, debug: boolean = false) {
  try {
    await page.waitForLoadState("networkidle");

    if (debug) {
      console.log("🔍 Network idle achieved, beginning element search...");
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log("📸 Debug screenshot saved as 'debug-screenshot.png'");
    }

    // Look for the bulk schedule button
    const buttonExists = await page.evaluate(() => {
      const button = document.querySelector('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
      return {
        exists: !!button,
        text: button?.textContent?.trim(),
        disabled: button?.hasAttribute('disabled') || false
      };
    });

    if (debug) {
      console.log("\n🔍 Button status:", buttonExists);
    }

    return buttonExists.exists;
  } catch (error) {
    console.error("Error while checking for activities:", error);
    if (debug) {
      console.error("\n🔍 Additional debug information at time of error:");
      console.error("URL:", await page.url());
    }
    return false;
  }
}

// Usage examples:
// Normal usage:
// await checkForActivities(page);

// With debugging:
// await checkForActivities(page, true);

// Main function to handle the activities page
async function handleActivitiesPage(page: Page) {
  const hasActivities = await checkForActivities(page, true);

  if (hasActivities) {
    try {
      // Wait for the button to be available
      await page.waitForSelector('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
      
      // Click the button
      await page.click('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
      console.log("Bulk schedule button clicked successfully.");
    } catch (error) {
      console.error("Error clicking bulk schedule button:", error);
    }
  } else {
    console.log("No bulk schedule button found.");
  }
}

(async () => {
  const browser = await firefox.launch({
    headless: false,
  });
  const context = await browser.newContext({
    viewport: { width: 2200, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await page.goto("https://accounts.gaggleamp.com/sign_in", {
      waitUntil: "networkidle",
      timeout: 60000, // Increase timeout to 60 seconds
    });

    // Wait for email input field to be visible and type
    await page.waitForSelector("#user_email", {
      state: "visible",
      timeout: 1000,
    });
    const usr = env.USR;
    await page.fill("#user_email", usr);

    await performActionWithDelay(page, async () => {
      await page.waitForSelector("#continue-button", {
        state: "visible",
        timeout: 1000,
      });
      await page.click("#continue-button");
    });

    await page.waitForSelector("#user_password", {
      state: "visible",
      timeout: 1000,
    });
    const pwd = env.PWD;
    await performActionWithDelay(page, async () => {
      await page.fill("#user_password", pwd);
      await page.click('input[type="submit"]');
    });

    console.log(`Login successful! [${new Date().toISOString()}]`);

    // Handle the activities page
    await handleActivitiesPage(page);

    // Optional: Take a screenshot of the final page state
    await page.screenshot({ path: "final-state-screenshot.png" });
  } catch (error) {
    console.error("An error occurred:", error);
    // Optional: Take a screenshot when an error occurs
    await page.screenshot({ path: "error-screenshot.png" });
  } finally {
    await context.close();
    await browser.close();
  }
})();
