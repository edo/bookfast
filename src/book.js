import { chromium } from 'playwright';
import { addDays, set, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file if it exists (for local testing)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('Loaded credentials from .env file');
} catch (err) {
  // .env file doesn't exist, use environment variables
}

const TIMEZONE = 'Europe/Amsterdam'; // CET/CEST
const LOGIN_URL = 'https://sportcentrumdetrits.dewi-online.nl/member/login';
const LESSONS_URL = 'https://sportcentrumdetrits.dewi-online.nl/member/lessons';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait until exactly 00:00:10 CET (10 seconds past midnight)
 */
async function waitUntilMidnightCET() {
  console.log('Waiting until 00:00:10 CET...');

  const now = new Date();
  const nowCET = toZonedTime(now, TIMEZONE);

  console.log(`Current time (CET): ${nowCET.toLocaleString('nl-NL', { timeZone: TIMEZONE })}`);

  // Create target time: 00:00:10 CET
  const targetCET = set(nowCET, { hours: 0, minutes: 0, seconds: 10, milliseconds: 0 });

  // If we're past 00:00:10, target tomorrow's 00:00:10
  let targetTime = targetCET;
  if (isBefore(targetCET, nowCET)) {
    targetTime = addDays(targetCET, 1);
  }

  const targetUTC = fromZonedTime(targetTime, TIMEZONE);

  console.log(`Target time (CET): ${targetTime.toLocaleString('nl-NL', { timeZone: TIMEZONE })}`);
  console.log(`Waiting ${Math.round((targetUTC.getTime() - Date.now()) / 1000)} seconds...`);

  // Wait loop with adaptive sleep
  while (Date.now() < targetUTC.getTime()) {
    const remaining = targetUTC.getTime() - Date.now();

    if (remaining > 5000) {
      await sleep(1000); // Sleep 1 second when far away
    } else {
      await sleep(50);   // Tight loop when close
    }
  }

  console.log('00:00:10! Starting booking process...');
}

/**
 * Main booking function
 */
async function bookPilates() {
  const isTestMode = process.argv.includes('--test');

  if (!isTestMode) {
    await waitUntilMidnightCET();
  } else {
    console.log('TEST MODE: Skipping midnight wait');
  }

  const browser = await chromium.launch({
    headless: !isTestMode // Show browser in test mode
  });

  const context = await browser.newContext({
    locale: 'nl-NL',
    timezoneId: TIMEZONE
  });

  const page = await context.newPage();

  // Set longer timeout for network operations
  page.setDefaultTimeout(30000);

  try {
    console.log('Step 1: Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    // Login
    console.log('Step 2: Logging in...');
    await page.fill('input#email[name="email"]', process.env.GYM_EMAIL);
    await page.fill('input#password[name="password"]', process.env.GYM_PASSWORD);

    // Click submit button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]:has-text("Inloggen")')
    ]);

    console.log('Step 3: Navigating to lessons page...');
    await page.goto(LESSONS_URL, { waitUntil: 'networkidle' });

    // Take screenshot of initial page
    await page.screenshot({ path: 'step1-lessons-page.png', fullPage: true });
    console.log('Screenshot saved: step1-lessons-page.png');

    // Navigate to next week (7 days from now = next Saturday)
    console.log('Step 4: Navigating to next week...');

    // Click the next period button (wire:click="nextPeriod")
    // There are 2 buttons (mobile + desktop), click the visible one
    const nextWeekButtons = page.locator('button[wire\\:click="nextPeriod"]');
    const count = await nextWeekButtons.count();

    if (count > 0) {
      // Find and click the visible button
      for (let i = 0; i < count; i++) {
        const button = nextWeekButtons.nth(i);
        if (await button.isVisible()) {
          await button.click();
          await page.waitForLoadState('networkidle');
          console.log('Navigated to next week');
          break;
        }
      }
    } else {
      console.log('No next week button found, assuming already on correct week');
    }

    await page.screenshot({ path: 'step2-next-week.png', fullPage: true });
    console.log('Screenshot saved: step2-next-week.png');

    // Find and click Pilates block
    console.log('Step 5: Finding Pilates class (08:30-09:25)...');

    // Strategy: Find element with wire:click="showLessonModal" containing "Pilates" and "08:30"
    const pilatesBlocks = page.locator('[wire\\:click*="showLessonModal"]')
      .filter({ hasText: 'Pilates' })
      .filter({ hasText: '08:30' });

    const pilatesCount = await pilatesBlocks.count();
    console.log(`Found ${pilatesCount} matching Pilates blocks`);

    if (pilatesCount === 0) {
      throw new Error('Could not find Pilates class at 08:30');
    }

    // Find the visible Pilates block and click it
    console.log('Step 6: Clicking Pilates block...');
    let clicked = false;
    for (let i = 0; i < pilatesCount; i++) {
      const block = pilatesBlocks.nth(i);
      if (await block.isVisible()) {
        await block.scrollIntoViewIfNeeded();
        await block.click();
        clicked = true;
        console.log(`Clicked Pilates block ${i + 1}`);
        break;
      }
    }

    if (!clicked) {
      throw new Error('Found Pilates blocks but none were visible');
    }

    // Wait for modal to appear
    console.log('Step 7: Waiting for modal...');
    await page.waitForSelector('button[wire\\:click="registerForLesson"]', { timeout: 5000 });

    await page.screenshot({ path: 'step3-modal-open.png', fullPage: true });
    console.log('Screenshot saved: step3-modal-open.png');

    // Click the register button
    console.log('Step 8: Clicking register button...');
    await page.click('button[wire\\:click="registerForLesson"]');

    // Wait for success indication
    await sleep(2000);

    await page.screenshot({ path: 'step4-after-register.png', fullPage: true });
    console.log('Screenshot saved: step4-after-register.png');

    // Check for success/error messages
    const successMessage = await page.locator('text=/ingeschreven|success|gelukt/i').count();
    const errorMessage = await page.locator('text=/vol|error|fout/i').count();

    if (successMessage > 0) {
      console.log('SUCCESS! Booking appears to have succeeded.');
    } else if (errorMessage > 0) {
      console.log('WARNING: Possible error detected. Check screenshots.');
    } else {
      console.log('UNKNOWN: No clear success or error message. Check screenshots.');
    }

    await page.screenshot({ path: 'booking-result.png', fullPage: true });
    console.log('Final screenshot saved: booking-result.png');

  } catch (error) {
    console.error('ERROR during booking process:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the booking function
bookPilates()
  .then(() => {
    console.log('Booking script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Booking script failed:', error);
    process.exit(1);
  });
