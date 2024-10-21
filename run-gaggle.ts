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

async function checkForActivities(page: puppeteer.Page) {
  try {
    // Wait for the page to load completely after login
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    
    // Check for either the "No Activities" image, the checkbox, or the button
    const result = await page.evaluate(() => {
      const noActivitiesImg = document.querySelector('img[alt="No Activities"]');
      const checkbox = document.getElementById('select-all-activities');
      const button = document.querySelector('button.btn.btn--ghost');
      
      if (noActivitiesImg) return 'no_activities';
      if (checkbox && button) return 'has_activities';
      return 'unknown';
    });

    if (result === 'no_activities') {
      console.log("No activities found.");
      return false;
    } else if (result === 'has_activities') {
      console.log("Activities found.");
      return true;
    } else {
      console.log("Unable to determine if there are activities.");
      return false;
    }
  } catch (error) {
    console.error("Error while checking for activities:", error);
    return false;
  }
}

// Main function to handle the activities page
async function handleActivitiesPage(page: puppeteer.Page) {
  const hasActivities = await checkForActivities(page);

  if (hasActivities) {
    // Wait for the checkbox to be available
    await page.waitForSelector('#select-all-activities');

    // Check if the checkbox is already checked
    const isChecked = await page.$eval('#select-all-activities', (checkbox: HTMLInputElement) => checkbox.checked);

    // If it's not checked, click it to check it
    if (!isChecked) {
      await page.click('#select-all-activities');
    }

    // Wait for the button to be available
    await page.waitForSelector('button.btn.btn--ghost');

    // Click the button
    await page.click('button.btn.btn--ghost');

    console.log("Checkbox selected and button clicked.");
  } else {
    console.log("No activities to schedule.");
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
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

    console.log("Login successful!");

    // Handle the activities page
    await handleActivitiesPage(page);

    // Optional: Take a screenshot of the final page state
    await page.screenshot({ path: "final-state-screenshot.png" });

  } catch (error) {
    console.error("An error occurred:", error);
    // Optional: Take a screenshot when an error occurs
    await page.screenshot({ path: "error-screenshot.png" });
  } finally {
    await browser.close();
  }
})();