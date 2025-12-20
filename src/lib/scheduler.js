import { addDays, set, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait until exactly 00:00:10 CET (10 seconds past midnight)
 * Uses adaptive sleep to be precise without burning CPU
 * @param {string} timezone - Timezone (e.g., 'Europe/Amsterdam')
 * @param {string} targetTime - Target time in HH:MM:SS format (default: '00:00:10')
 */
export async function waitUntilMidnightCET(timezone = 'Europe/Amsterdam', targetTime = '00:00:10') {
  console.log(`Waiting until ${targetTime} ${timezone}...`);

  const now = new Date();
  const nowCET = toZonedTime(now, timezone);

  console.log(`Current time (${timezone}): ${nowCET.toLocaleString('nl-NL', { timeZone: timezone })}`);

  // Parse target time (HH:MM:SS)
  const [hours, minutes, seconds] = targetTime.split(':').map(Number);

  // Create target time: specified time today in CET
  const targetCET = set(nowCET, { hours, minutes, seconds, milliseconds: 0 });

  // If we're past the target time, target tomorrow's time
  let finalTargetTime = targetCET;
  if (isBefore(targetCET, nowCET)) {
    finalTargetTime = addDays(targetCET, 1);
  }

  const targetUTC = fromZonedTime(finalTargetTime, timezone);

  console.log(`Target time (${timezone}): ${finalTargetTime.toLocaleString('nl-NL', { timeZone: timezone })}`);
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

  console.log(`${targetTime}! Starting booking process...`);
}
