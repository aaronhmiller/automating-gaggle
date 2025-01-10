import { firefox, type Page } from "npm:playwright";
import { load } from "https://deno.land/std/dotenv/mod.ts";

const env = await load();

// Add timestamp logging function
function logWithTimestamp(message: string, error?: Error) {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  if (error) {
    console.error(`[${timestamp} PT] ERROR: ${message}`, error);
  } else {
    console.log(`[${timestamp} PT] ${message}`);
  }
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

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
    logWithTimestamp("Waiting for network idle state...");
    await page.waitForLoadState("networkidle");

    if (debug) {
      logWithTimestamp("Network idle achieved, beginning element search...");
    }

    // Look for the "All Caught Up!" message
    const noActivitiesExists = await page.evaluate(() => {
      const noItemsDiv = document.querySelector('.ga3-no-items-prompt');
      const heading = document.querySelector('.no-items-heading');
      return {
        exists: !!noItemsDiv && heading?.textContent?.includes('All Caught Up!'),
        text: heading?.textContent?.trim()
      };
    });

    if (debug) {
      logWithTimestamp(`No activities status: ${JSON.stringify(noActivitiesExists)}`);
    }

    if (noActivitiesExists.exists) {
      logWithTimestamp("Found 'All Caught Up!' message - no activities to process");
      return false;
    }

    const buttonExists = await page.evaluate(() => {
      const button = document.querySelector('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
      return {
        exists: !!button,
        text: button?.textContent?.trim(),
        disabled: button?.hasAttribute('disabled') || false
      };
    });

    if (debug) {
      logWithTimestamp(`Button status: ${JSON.stringify(buttonExists)}`);
    }

    return buttonExists.exists;
  } catch (error) {
    logWithTimestamp("Error while checking for activities", error as Error);
    if (debug) {
      logWithTimestamp(`Current URL: ${await page.url()}`);
    }
    return false;
  }
}

async function handleActivitiesPage(page: Page): Promise<boolean> {
  logWithTimestamp("Starting activities page handling");
  const hasActivities = await checkForActivities(page, true);

  if (!hasActivities) {
    logWithTimestamp("No activities found - exiting cleanly");
    return true;
  }

  try {
    logWithTimestamp("Waiting for bulk schedule button...");
    await page.waitForSelector('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
    
    logWithTimestamp("Clicking bulk schedule button...");
    await page.click('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
    logWithTimestamp("Bulk schedule button clicked successfully");
    return true;
  } catch (error) {
    logWithTimestamp("Error clicking bulk schedule button", error as Error);
    return false;
  }
}

async function main() {
  logWithTimestamp("Starting browser launch");
  let browser;
  let context;
  
  try {
    browser = await firefox.launch({
      headless: true,
      timeout: 30000, // Reduce timeout to 30 seconds
    });
    logWithTimestamp("Browser launched successfully");

    context = await browser.newContext({
      viewport: { width: 2200, height: 1000 },
    });
    logWithTimestamp("Browser context created");

    const page = await context.newPage();
    logWithTimestamp("New page created");

    logWithTimestamp("Navigating to sign-in page...");
    await page.goto("https://accounts.gaggleamp.com/sign_in", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Login process
    logWithTimestamp("Starting login process");
    await page.waitForSelector("#user_email", {
      state: "visible",
      timeout: 5000,
    });
    const usr = env.USR;
    await page.fill("#user_email", usr);

    await performActionWithDelay(page, async () => {
      await page.waitForSelector("#continue-button", {
        state: "visible",
        timeout: 5000,
      });
      await page.click("#continue-button");
    });

    await page.waitForSelector("#user_password", {
      state: "visible",
      timeout: 5000,
    });
    const pwd = env.PWD;
    await performActionWithDelay(page, async () => {
      await page.fill("#user_password", pwd);
      await page.click('input[type="submit"]');
    });

    logWithTimestamp("Login successful!");

    const result = await handleActivitiesPage(page);
    
    await context.close();
    await browser.close();
    
    if (result) {
      logWithTimestamp("Script completed successfully");
      Deno.exit(0);
    } else {
      logWithTimestamp("Script completed with errors");
      Deno.exit(1);
    }

  } catch (error) {
    logWithTimestamp("An error occurred in main execution", error as Error);
    if (context) await context.close();
    if (browser) await browser.close();
    Deno.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  logWithTimestamp("Unhandled error in main function", error as Error);
  Deno.exit(1);
});
