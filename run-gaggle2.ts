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
      console.log("\n🔍 No activities status:", noActivitiesExists);
    }

    // If we find the "All Caught Up!" message, return false (no activities to process)
    if (noActivitiesExists.exists) {
      console.log("Found 'All Caught Up!' message - no activities to process");
      return false;
    }

    // Check for bulk schedule button
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
      console.log("\n🔍 Additional debug information at time of error:");
      console.log("URL:", await page.url());
    }
    return false;
  }
}

// Main function to handle the activities page
async function handleActivitiesPage(page: Page): Promise<boolean> {
  const hasActivities = await checkForActivities(page, true);

  if (!hasActivities) {
    console.log("No activities found - exiting cleanly");
    return true;  // Return true to indicate successful completion
  }

  try {
    // Wait for the button to be available
    await page.waitForSelector('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
    
    // Click the button
    await page.click('button[data-action="click->ga3--widgets--bulk-schedule#bulkSchedule"]');
    console.log("Bulk schedule button clicked successfully.");
    return true;  // Return true to indicate successful completion
  } catch (error) {
    console.error("Error clicking bulk schedule button:", error);
    return false;  // Return false to indicate an error occurred
  }
}

async function main() {
  const browser = await firefox.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 2200, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await page.goto("https://accounts.gaggleamp.com/sign_in", {
      waitUntil: "networkidle",
      timeout: 60000, // 60 second timeout
    });

    // Login process
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

    console.log(`Login successful! [${new Date().toISOString()}]`);

    // Handle the activities page
    const result = await handleActivitiesPage(page);
    
    // Close browser and exit with appropriate status
    await context.close();
    await browser.close();
    
    if (result) {
      console.log("Script completed successfully");
      Deno.exit(0);  // Exit with success status
    } else {
      console.error("Script completed with errors");
      Deno.exit(1);  // Exit with error status
    }

  } catch (error) {
    console.error("An error occurred:", error);
    await context.close();
    await browser.close();
    Deno.exit(1);  // Exit with error status
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});