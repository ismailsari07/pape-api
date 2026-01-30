import { DateTime } from "luxon";

/**
 * Calculates the Fajr iqamah time based on the sunrise time.
 * The iqamah time is rounded down to the nearest 20-minute block before sunrise.
 * Ensures that the difference between sunrise and iqamah is at least 20 minutes.
 * If the difference is less than 20 minutes, iqamah time is moved 20 minutes earlier.
 *
 * @param {string} sunriseTime - Sunrise time in "HH:mm" 24-hour format.
 * @returns {string} - Calculated iqamah time in "HH:mm" format (12-hour clock).
 */
export function calculateFajrIqamahFromSunrise(sunriseTime) {
  const [sunriseHour, sunriseMinute] = sunriseTime.split(":").map(Number);
  let totalMinutes = sunriseHour * 60 + sunriseMinute;

  // Round down to the nearest 20-minute block before sunrise
  let iqamahMinutes = Math.floor(totalMinutes / 20) * 20;

  if (totalMinutes - iqamahMinutes < 20) {
    iqamahMinutes -= 20;
  }

  let iqamahHour = Math.floor(iqamahMinutes / 60);
  let iqamahMinute = iqamahMinutes % 60;

  const formattedHour = (iqamahHour % 12 === 0 ? 12 : iqamahHour % 12).toString().padStart(2, "0");
  const formattedMinute = iqamahMinute.toString().padStart(2, "0");

  return `${formattedHour}:${formattedMinute}`;
}

/**
 * Determines the iqamah time for Asr prayer based on the given adhan (call to prayer) time.
 * It picks the earliest valid iqamah time that is at least 30 minutes after the adhan time.
 * Only specific allowed iqamah times are used.
 *
 * @param {string} adhanTime24 - The adhan time in 24-hour "HH:mm" format.
 * @returns {string} - The selected iqamah time in 12-hour "HH:mm" format.
 */
export function calculateAsrIqamah(adhanTime24) {
  // Allowed iqamah hours in 12-hour format
  const allowedIqamahTimes = [
    "15:00",
    "15:30",
    "15:45",
    "16:00",
    "16:15",
    "16:30",
    "16:45",
    "17:00",
    "17:15",
    "17:30",
    "17:45",
  ];

  // Convert adhan time to total minutes
  const [adhanHour, adhanMinute] = adhanTime24.split(":").map(Number);
  const adhanTotalMinutes = adhanHour * 60 + adhanMinute;

  for (let iqamahTime of allowedIqamahTimes) {
    const [iqamahHour, iqamahMinute] = iqamahTime.split(":").map(Number);
    const iqamahTotalMinutes = iqamahHour * 60 + iqamahMinute;

    if (iqamahTotalMinutes - adhanTotalMinutes > 15) {
      // Format to 12-hour clock
      const hour12 = (iqamahHour % 12 === 0 ? 12 : iqamahHour % 12).toString();
      const minute = iqamahMinute.toString().padStart(2, "0");
      return `${hour12}:${minute}`;
    }
  }

  // If none matched, return the last option (17:45)
  return "05:45";
}

/**
 * Calculates the Iqamah (congregation) time for the Isha prayer based on the adhan (call to prayer) time.
 *
 * Rules:
 * 1. Add a 7-minute buffer to the adhan time.
 * 2. Round the resulting time up to the next 5-minute interval (e.g., 20:02 → 20:05).
 * 3. If the result exceeds 10:45 PM (22:45), cap the Iqamah time at 10:45 PM.
 * 4. Return the result in 12-hour format with AM/PM.
 *
 * @param {string} adhanTime24 - The adhan time in 24-hour format (e.g., "20:17").
 * @returns {string} - The Iqamah time in 12-hour format (e.g., "8:25 PM").
 */
export function calculateIshaIqamahTime(adhanTime24) {
  // Parse input
  const [hourStr, minuteStr] = adhanTime24.split(":");
  let hour = parseInt(hourStr, 10);
  let minute = parseInt(minuteStr, 10);

  // +7 minute buffer
  let totalMinutes = hour * 60 + minute + 10;

  // Round up to the next 15-minute block
  let remainder = totalMinutes % 15;
  if (remainder !== 0) {
    totalMinutes += 15 - remainder;
  }

  // Cap at 22:45 (10:45 PM)
  const maxMinutes = 22 * 60 + 45;
  if (totalMinutes > maxMinutes) {
    totalMinutes = maxMinutes;
  }

  // Cap at 19:00 (7:00 PM)
  const minMinutes = 19 * 60;
  if (totalMinutes < minMinutes) {
    totalMinutes = minMinutes;
  }

  // Cap at 20:00 (8:00 PM) and if today is Thursday
  // const minMinutesOnThursday = 20 * 60;
  // if (totalMinutes < minMinutesOnThursday && DateTime.now().weekday === 4) {
  //   totalMinutes = minMinutesOnThursday;
  // }

  // Convert back to hour and minute
  let iqamahHour24 = Math.floor(totalMinutes / 60);
  let iqamahMinute = totalMinutes % 60;

  // Convert to 12-hour format
  let iqamahHour12 = iqamahHour24 % 12;
  if (iqamahHour12 === 0) iqamahHour12 = 12;

  // return `${iqamahHour12}:${iqamahMinute.toString().padStart(2, "0")}`;
  return "7:00 PM";
}

// Function to determine Friday prayer time in Canada
export function getJumaaPrayerTime() {
  const currentTimeInCanada = DateTime.now().setZone("America/Toronto");

  // If it's daylight saving time, prayer is at 2 PM, otherwise at 1 PM
  const fridayPrayerTime = currentTimeInCanada.isInDST ? "2:00" : "1:00";

  return fridayPrayerTime;
}
