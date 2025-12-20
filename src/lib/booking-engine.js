const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Login to the gym website
 * @param {Page} page - Playwright page object
 * @param {string} loginUrl - Login URL
 */
export async function login(page, loginUrl) {
  console.log('Step 1: Navigating to login page...');
  await page.goto(loginUrl, { waitUntil: 'networkidle' });

  console.log('Step 2: Logging in...');
  await page.fill('input#email[name="email"]', process.env.GYM_EMAIL);
  await page.fill('input#password[name="password"]', process.env.GYM_PASSWORD);

  // Click submit button and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]:has-text("Inloggen")')
  ]);

  console.log('Login successful');
}

/**
 * Book a single class
 * @param {Page} page - Playwright page object
 * @param {Object} classConfig - Class configuration object
 * @param {string} lessonsUrl - Lessons page URL
 * @returns {Object} Result object with success status and message
 */
export async function bookSingleClass(page, classConfig, lessonsUrl) {
  const { id, className, timeSlot, dayName } = classConfig;

  try {
    console.log(`\n=== Booking ${className} on ${dayName} at ${timeSlot} ===`);

    console.log('Step 3: Navigating to lessons page...');
    await page.goto(lessonsUrl, { waitUntil: 'networkidle' });

    // Take screenshot of initial page
    await page.screenshot({ path: `${id}-step1-lessons-page.png`, fullPage: true });
    console.log(`Screenshot saved: ${id}-step1-lessons-page.png`);

    // Navigate to next week (7 days from now)
    console.log('Step 4: Navigating to next week...');

    // Take screenshot before navigation
    await page.screenshot({ path: `${id}-step1b-before-next-week.png`, fullPage: true });

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

          // Wait for Livewire to update the page
          // Give it extra time for the AJAX request and DOM update
          await sleep(2000); // Wait 2 seconds for Livewire
          await page.waitForLoadState('networkidle');
          await sleep(1000); // Extra safety margin

          console.log('Navigated to next week');
          break;
        }
      }
    } else {
      console.log('No next week button found, assuming already on correct week');
    }

    await page.screenshot({ path: `${id}-step2-next-week.png`, fullPage: true });
    console.log(`Screenshot saved: ${id}-step2-next-week.png`);

    // CRITICAL: Find the correct day section first, then find the class within it
    console.log(`Step 5: Finding ${className} class on ${dayName} at ${timeSlot}...`);

    // Find all day sections (each has a day header with the day name)
    // Based on HTML: <div class="text-lg font-semibold">zaterdag</div>
    const dayHeaders = page.locator('.text-lg.font-semibold, .text-xl.font-semibold');
    const dayHeaderCount = await dayHeaders.count();
    console.log(`Found ${dayHeaderCount} total day headers`);

    let classBlock = null;

    // Find which header matches our target day
    for (let i = 0; i < dayHeaderCount; i++) {
      const header = dayHeaders.nth(i);
      const headerText = await header.textContent();

      if (headerText && headerText.trim().toLowerCase() === dayName.toLowerCase()) {
        console.log(`Found matching day header: "${headerText.trim()}" at index ${i}`);

        // The day section structure is: header is inside a parent div that contains the whole day
        // Go up to the parent container (class="bg-white")
        const dayContainer = header.locator('xpath=ancestor::div[contains(@class, "bg-white")]').first();

        // Within this day container, find classes matching our criteria
        classBlock = dayContainer
          .locator('[wire\\:click*="showLessonModal"]')
          .filter({ hasText: className })
          .filter({ hasText: timeSlot });

        const classCount = await classBlock.count();
        console.log(`Found ${classCount} matching class(es) in ${dayName} section`);

        if (classCount > 0) {
          break; // Found it!
        }
      }
    }

    // Fallback: if day-specific search didn't work, search entire page
    if (!classBlock || await classBlock.count() === 0) {
      console.log('Day-specific search failed. Searching entire page...');
      classBlock = page.locator('[wire\\:click*="showLessonModal"]')
        .filter({ hasText: className })
        .filter({ hasText: timeSlot });
    }

    const blockCount = await classBlock.count();
    console.log(`Total matching blocks found: ${blockCount}`);

    if (blockCount === 0) {
      throw new Error(`Could not find ${className} class at ${timeSlot} on ${dayName}`);
    }

    // Find the visible class block and click it
    console.log('Step 6: Clicking class block...');
    let clicked = false;
    for (let i = 0; i < blockCount; i++) {
      const block = classBlock.nth(i);
      if (await block.isVisible()) {
        await block.scrollIntoViewIfNeeded();
        await block.click();
        clicked = true;
        console.log(`Clicked class block ${i + 1}`);
        break;
      }
    }

    if (!clicked) {
      throw new Error('Found class blocks but none were visible');
    }

    // Wait for modal to appear
    console.log('Step 7: Waiting for modal...');
    await page.waitForSelector('button[wire\\:click="registerForLesson"]', { timeout: 10000 });

    await page.screenshot({ path: `${id}-step3-modal-open.png`, fullPage: true });
    console.log(`Screenshot saved: ${id}-step3-modal-open.png`);

    // Click the register button
    console.log('Step 8: Clicking register button...');
    await page.click('button[wire\\:click="registerForLesson"]');

    // Wait for success indication
    await sleep(2000);

    await page.screenshot({ path: `${id}-step4-after-register.png`, fullPage: true });
    console.log(`Screenshot saved: ${id}-step4-after-register.png`);

    // Check for success/error messages
    const successMessage = await page.locator('text=/ingeschreven|success|gelukt/i').count();
    const errorMessage = await page.locator('text=/vol|error|fout/i').count();
    const alreadyRegistered = await page.locator('text=/reeds|already|al ingeschreven/i').count();
    const classFull = await page.locator('text=/vol|full/i').count();

    let result = {
      success: false,
      message: 'Unknown result',
      classConfig,
      isRetryable: true
    };

    if (successMessage > 0) {
      console.log('SUCCESS! Booking appears to have succeeded.');
      result = {
        success: true,
        message: 'Booking successful',
        classConfig,
        isRetryable: false
      };
    } else if (alreadyRegistered > 0) {
      console.log('Already registered for this class');
      result = {
        success: true, // Consider this a success since user is registered
        message: 'Already registered',
        classConfig,
        isRetryable: false
      };
    } else if (classFull > 0 || errorMessage > 0) {
      console.log('Class appears to be full or error occurred');
      result = {
        success: false,
        message: 'Class full or error',
        classConfig,
        isRetryable: false // Don't retry if class is full
      };
    } else {
      console.log('UNKNOWN: No clear success or error message. Check screenshots.');
      result = {
        success: false,
        message: 'No confirmation message found',
        classConfig,
        isRetryable: true // Retry since we're not sure what happened
      };
    }

    await page.screenshot({ path: `${id}-booking-result.png`, fullPage: true });
    console.log(`Final screenshot saved: ${id}-booking-result.png`);

    return result;

  } catch (error) {
    console.error(`Error booking ${className}: ${error.message}`);

    // Take error screenshot
    try {
      await page.screenshot({ path: `${id}-error-screenshot.png`, fullPage: true });
      console.log(`Error screenshot saved: ${id}-error-screenshot.png`);
    } catch (screenshotError) {
      console.error('Could not take error screenshot');
    }

    // Determine if error is retryable
    const isRetryable = isRetryableError(error);

    return {
      success: false,
      message: error.message,
      classConfig,
      isRetryable,
      error: error
    };
  }
}

/**
 * Determine if an error should trigger a retry
 * @param {Error} error - The error object
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  const retryablePatterns = [
    'timeout',
    'network',
    'connection',
    'element not found',
    'element is not visible',
    'modal',
    'navigation'
  ];

  const errorMessage = error.message.toLowerCase();

  return retryablePatterns.some(pattern =>
    errorMessage.includes(pattern)
  );
}
