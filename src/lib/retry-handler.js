import { chromium } from 'playwright';
import { login, bookSingleClass } from './booking-engine.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const LOGIN_URL = 'https://sportcentrumdetrits.dewi-online.nl/member/login';
const LESSONS_URL = 'https://sportcentrumdetrits.dewi-online.nl/member/lessons';

/**
 * Book a class with retry logic
 * @param {Object} classConfig - Class configuration object
 * @param {boolean} headless - Run browser in headless mode (default: true)
 * @returns {Object} Result object with success status and details
 */
export async function bookClassWithRetry(classConfig, headless = true) {
  const { maxRetries, retryDelayMs } = classConfig.retryConfig;
  const maxAttempts = maxRetries + 1; // Initial attempt + retries

  let lastResult = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Attempt ${attempt + 1}/${maxAttempts} for ${classConfig.className}`);
    console.log(`${'='.repeat(60)}\n`);

    let browser = null;
    let page = null;

    try {
      // Launch fresh browser for each attempt
      browser = await chromium.launch({
        headless: headless
      });

      const context = await browser.newContext({
        locale: 'nl-NL',
        timezoneId: 'Europe/Amsterdam'
      });

      page = await context.newPage();

      // Login
      await login(page, LOGIN_URL);

      // Attempt to book the class
      const result = await bookSingleClass(page, classConfig, LESSONS_URL);

      lastResult = {
        ...result,
        attempt: attempt + 1,
        totalAttempts: maxAttempts
      };

      // If booking succeeded, return immediately
      if (result.success) {
        console.log(`\n✓ Success on attempt ${attempt + 1}`);
        await browser.close();
        return lastResult;
      }

      // If booking failed but is not retryable, don't retry
      if (!result.isRetryable) {
        console.log(`\n✗ Non-retryable error on attempt ${attempt + 1}: ${result.message}`);
        await browser.close();
        return lastResult;
      }

      // If this wasn't the last attempt, retry
      if (attempt < maxAttempts - 1) {
        console.log(`\n⟳ Retrying in ${retryDelayMs}ms... (${maxAttempts - attempt - 1} attempts remaining)`);
        await browser.close();
        await sleep(retryDelayMs);
      } else {
        console.log(`\n✗ Failed after ${maxAttempts} attempts`);
        await browser.close();
      }

    } catch (error) {
      console.error(`Exception on attempt ${attempt + 1}:`, error.message);

      lastResult = {
        success: false,
        message: `Exception: ${error.message}`,
        classConfig,
        isRetryable: true,
        error,
        attempt: attempt + 1,
        totalAttempts: maxAttempts
      };

      // Close browser if it's open
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError.message);
        }
      }

      // Retry if not last attempt
      if (attempt < maxAttempts - 1) {
        console.log(`\n⟳ Retrying after exception in ${retryDelayMs}ms...`);
        await sleep(retryDelayMs);
      }
    }
  }

  // All attempts failed
  return lastResult;
}

/**
 * Book multiple classes sequentially with retry logic
 * @param {Array} classConfigs - Array of class configuration objects
 * @param {boolean} headless - Run browser in headless mode (default: true)
 * @returns {Array} Array of result objects
 */
export async function bookMultipleClasses(classConfigs, headless = true) {
  const results = [];

  for (let i = 0; i < classConfigs.length; i++) {
    const classConfig = classConfigs[i];

    console.log(`\n${'#'.repeat(60)}`);
    console.log(`Booking class ${i + 1}/${classConfigs.length}: ${classConfig.className}`);
    console.log(`${'#'.repeat(60)}\n`);

    const result = await bookClassWithRetry(classConfig, headless);
    results.push(result);

    // Small delay between classes to avoid overwhelming the server
    if (i < classConfigs.length - 1) {
      console.log('\nWaiting 2 seconds before next class...\n');
      await sleep(2000);
    }
  }

  return results;
}
