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
    // Wait for the page to load completely after login
    await page.waitForLoadState("networkidle");

    if (debug) {
      console.log("🔍 Network idle achieved, beginning element search...");
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log("📸 Debug screenshot saved as 'debug-screenshot.png'");
      
      // Log all images and their alt texts
      const imgCount = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        console.log(`Found ${images.length} images on page:`);
        images.forEach((img, i) => {
          console.log(`Image ${i + 1}:`, {
            alt: img.alt,
            src: img.src,
            visible: img.offsetParent !== null,
            dimensions: `${img.width}x${img.height}`
          });
        });
        return images.length;
      });
      console.log(`📊 Total images found: ${imgCount}`);
    }

    // Check for elements with detailed logging
    const result = await page.evaluate((debugMode) => {
      const debugInfo: any = {
        noActivitiesImg: null,
        checkbox: null,
        button: null
      };

      // Check for "No Activities" image
      const noActivitiesImg = document.querySelector(
        'img[alt="No Activities"]'
      );
      debugInfo.noActivitiesImg = noActivitiesImg ? {
        alt: (noActivitiesImg as HTMLImageElement).alt,
        src: (noActivitiesImg as HTMLImageElement).src,
        visible: noActivitiesImg.offsetParent !== null,
        dimensions: `${(noActivitiesImg as HTMLImageElement).width}x${(noActivitiesImg as HTMLImageElement).height}`
      } : null;

      // Check for checkbox
      const checkbox = document.getElementById("select-all-activities");
      debugInfo.checkbox = checkbox ? {
        visible: checkbox.offsetParent !== null,
        disabled: checkbox.hasAttribute('disabled'),
        type: checkbox.getAttribute('type')
      } : null;

      // Check for button
      const button = document.querySelector("button.btn.btn--ghost");
      debugInfo.button = button ? {
        text: button.textContent?.trim(),
        visible: button.offsetParent !== null,
        disabled: button.hasAttribute('disabled'),
        classes: button.className
      } : null;

      // Determine result
      let result = "unknown";
      if (noActivitiesImg) result = "no_activities";
      if (checkbox && button) result = "has_activities";

      return {
        result,
        debugInfo: debugMode ? debugInfo : null
      };
    }, debug);

    if (debug) {
      console.log("\n🔍 Debug Information:");
      console.log(JSON.stringify(result.debugInfo, null, 2));
      
      // Log DOM structure around key areas
      await page.evaluate(() => {
        const logElementContext = (element: Element | null, description: string) => {
          if (!element) {
            console.log(`${description} not found`);
            return;
          }
          
          console.log(`\n${description} context:`);
          console.log('Parent:', element.parentElement?.outerHTML);
          console.log('Element:', element.outerHTML);
          console.log('Next sibling:', element.nextElementSibling?.outerHTML);
        };

        logElementContext(
          document.querySelector('img[alt="No Activities"]'),
          '"No Activities" image'
        );
        logElementContext(
          document.getElementById('select-all-activities'),
          'Checkbox'
        );
        logElementContext(
          document.querySelector('button.btn.btn--ghost'),
          'Ghost button'
        );
      });
    }

    if (result.result === "no_activities") {
      console.log(debug ? "🚫 No activities found (with debug info above)." : "No activities found.");
      return false;
    } else if (result.result === "has_activities") {
      console.log(debug ? "✅ Activities found (with debug info above)." : "Activities found.");
      return true;
    } else {
      console.log(debug ? "❓ Unable to determine if there are activities (see debug info above)." : "Unable to determine if there are activities.");
      return false;
    }
  } catch (error) {
    console.error("Error while checking for activities:", error);
    if (debug) {
      console.error("\n🔍 Additional debug information at time of error:");
      console.error("URL:", await page.url());
      console.error("Current HTML:", await page.content());
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
    // Wait for the checkbox to be available
    await page.waitForSelector("#select-all-activities");

    // Check if the checkbox is already checked
    const isChecked = await page.isChecked("#select-all-activities");

    // If it's not checked, click it to check it
    if (!isChecked) {
      await page.click("#select-all-activities");
    }

    // Wait for the button to be available and click it
    await page.click("button.btn.btn--ghost");

    console.log("Checkbox selected and button clicked.");
  } else {
    console.log("No activities to schedule.");
  }
}

(async () => {
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
