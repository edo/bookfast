import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig, getClassesForDay } from './lib/config-loader.js';
import { waitUntilMidnightCET } from './lib/scheduler.js';
import { bookMultipleClasses } from './lib/retry-handler.js';

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

/**
 * Main booking function
 */
async function main() {
  const isTestMode = process.argv.includes('--test');
  const specificClass = process.argv.find(arg => arg.startsWith('--class='))?.split('=')[1];

  console.log('='.repeat(60));
  console.log('BOOKFAST - Multi-Class Gym Booking System');
  console.log('='.repeat(60));

  // Load configuration
  let config;
  try {
    config = loadConfig('config/classes.json');
  } catch (error) {
    console.error('Failed to load configuration:', error.message);
    process.exit(1);
  }

  // Get today's day of week (0=Sunday, 6=Saturday)
  const today = new Date().getDay();
  const dayNames = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  const todayName = dayNames[today];

  console.log(`\nToday is ${todayName} (day ${today})`);

  // Filter classes for today
  let todaysClasses = getClassesForDay(config, today);

  // If specific class ID specified, filter to just that class
  if (specificClass) {
    todaysClasses = todaysClasses.filter(c => c.id === specificClass);
    if (todaysClasses.length === 0) {
      console.log(`\nNo class found with ID: ${specificClass}`);
      process.exit(0);
    }
    console.log(`\nFiltered to specific class: ${specificClass}`);
  }

  if (todaysClasses.length === 0) {
    console.log('\nNo enabled classes configured for today.');
    console.log('Exiting without booking anything.');
    process.exit(0);
  }

  console.log(`\nFound ${todaysClasses.length} class(es) to book today:`);
  todaysClasses.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.className} at ${c.timeSlot} (${c.id})`);
  });

  // Wait until midnight (unless in test mode)
  if (!isTestMode) {
    const { timezone, bookingStartTime } = config.globalSettings;
    await waitUntilMidnightCET(timezone, bookingStartTime);
  } else {
    console.log('\nTEST MODE: Skipping midnight wait');
  }

  // Book all classes with retry logic
  console.log('\n' + '='.repeat(60));
  console.log('STARTING BOOKING PROCESS');
  console.log('='.repeat(60));

  const results = await bookMultipleClasses(todaysClasses, !isTestMode);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('BOOKING SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal classes: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  console.log('\nDetailed results:');
  results.forEach((result, i) => {
    const status = result.success ? '✓' : '✗';
    const className = result.classConfig.className;
    const timeSlot = result.classConfig.timeSlot;
    const message = result.message;
    const attempts = result.totalAttempts > 1 ? ` (${result.attempt}/${result.totalAttempts} attempts)` : '';

    console.log(`  ${status} ${className} at ${timeSlot}: ${message}${attempts}`);
  });

  // Exit with error code if any bookings failed
  if (failed > 0) {
    console.log('\n⚠️  Some bookings failed. Check logs and screenshots.');
    process.exit(1);
  } else {
    console.log('\n✓ All bookings completed successfully!');
    process.exit(0);
  }
}

// Run the main function
main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
