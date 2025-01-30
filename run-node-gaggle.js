const { chromium } = require('@playwright/test');
require('dotenv').config();

// Helper functions
const logWithTimestamp = (message, error) => {
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
};

const randomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const performActionWithDelay = async (page, action) => {
  await page.waitForTimeout(randomDelay(500, 1500));
  await action();
  await page.waitForTimeout(randomDelay(500, 1500));
};

async function checkForActivities(page, debug = false) {
  try {
    logWithTimestamp("Waiting for network idle state...");
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    if (debug) {
      logWithTimestamp("Network idle achieved, beginning element search...");
    }

    const noActivitiesExists = await page.evaluate(() => {
      const noItemsDiv = document.querySelector('.ga3-no-items-prompt');
      const heading = document.querySelector('.no-items-heading');
      return {
        exists: !!noItemsDiv && heading?.textContent?.includes('All Caught Up!'),
        text: heading?.textContent?.trim()
      };
    });

    if (noActivitiesExists.exists) {
      logWithTimestamp("Found 'All Caught Up!' message - no activities to process");
      return false;
    }

    const buttonExists = await page.$eval(
      'button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]',
      button => ({
        exists: true,
        text: button.textContent?.trim(),
        disabled: button.hasAttribute('disabled')
      })
    ).catch(() => ({ exists: false, text: null, disabled: true }));

    if (debug) {
      logWithTimestamp(`Button status: ${JSON.stringify(buttonExists)}`);
    }

    return buttonExists.exists;
  } catch (error) {
    logWithTimestamp("Error while checking for activities", error);
    return false;
  }
}

async function handleActivitiesPage(page) {
  logWithTimestamp("Starting activities page handling");
  const hasActivities = await checkForActivities(page, true);

  if (!hasActivities) {
    logWithTimestamp("No activities found - exiting cleanly");
    return true;
  }

  try {
    logWithTimestamp("Waiting for bulk schedule button...");
    const button = await page.waitForSelector(
      'button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]',
      { timeout: 10000, state: 'visible' }
    );
    
    if (!button) {
      throw new Error("Button not found after waiting");
    }
    
    logWithTimestamp("Clicking bulk schedule button...");
    await button.click({ timeout: 5000 });
    logWithTimestamp("Bulk schedule button clicked successfully");
    return true;
  } catch (error) {
    logWithTimestamp("Error clicking bulk schedule button", error);
    return false;
  }
}

async function main() {
  logWithTimestamp("Starting browser launch");
  let browser;
  let context;
  
  try {
    browser = await chromium.launch({
      headless: true
    });
    
    logWithTimestamp("Browser launched successfully");

    context = await browser.newContext({
      viewport: { width: 2200, height: 1000 }
    });
    
    const page = await context.newPage();
    logWithTimestamp("New page created");

    await page.goto("https://accounts.gaggleamp.com/sign_in", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    // Login process
    logWithTimestamp("Starting login process");
    await page.waitForSelector("#user_email", { state: "visible", timeout: 5000 });
    await page.fill("#user_email", process.env.USR);

    await performActionWithDelay(page, async () => {
      await page.waitForSelector("#continue-button", { state: "visible", timeout: 5000 });
      await page.click("#continue-button");
    });

    await page.waitForSelector("#user_password", { state: "visible", timeout: 5000 });
    await performActionWithDelay(page, async () => {
      await page.fill("#user_password", process.env.PWD);
      await page.click('input[type="submit"]');
    });

    logWithTimestamp("Login successful!");

    const result = await handleActivitiesPage(page);
    
    await context.close();
    await browser.close();
    
    if (result) {
      logWithTimestamp("Script completed successfully");
      process.exit(0);
    } else {
      logWithTimestamp("Script completed with errors");
      process.exit(1);
    }

  } catch (error) {
    logWithTimestamp("An error occurred in main execution", error);
    if (context) await context.close();
    if (browser) await browser.close();
    process.exit(1);
  }
}

main().catch((error) => {
  logWithTimestamp("Unhandled error in main function", error);
  process.exit(1);
});
