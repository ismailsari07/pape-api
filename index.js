// import fetch module
import fetch from 'node-fetch';
import { DateTime } from 'luxon';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();


/**
 * Calculates the Fajr iqamah time based on the sunrise time.
 * The iqamah time is rounded down to the nearest 20-minute block before sunrise.
 * Ensures that the difference between sunrise and iqamah is at least 20 minutes.
 * If the difference is less than 20 minutes, iqamah time is moved 20 minutes earlier.
 *
 * @param {string} sunriseTime - Sunrise time in "HH:mm" 24-hour format.
 * @returns {string} - Calculated iqamah time in "HH:mm" format (12-hour clock).
 */
function calculateFajrIqamahFromSunrise(sunriseTime) {
  const [sunriseHour, sunriseMinute] = sunriseTime.split(":").map(Number);
  let totalMinutes = sunriseHour * 60 + sunriseMinute;

  // Round down to the nearest 20-minute block before sunrise
  let iqamahMinutes = Math.floor(totalMinutes / 20) * 20;

  if ((totalMinutes - iqamahMinutes) < 20) {
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
function calculateAsrIqamah(adhanTime24) {
  // Allowed iqamah hours in 12-hour format
  const allowedIqamahTimes = [
    "15:00", "15:30", "16:30", "17:00", "17:15", "17:30", "17:45"
  ];

  // Convert adhan time to total minutes
  const [adhanHour, adhanMinute] = adhanTime24.split(":").map(Number);
  const adhanTotalMinutes = adhanHour * 60 + adhanMinute;

  for (let iqamahTime of allowedIqamahTimes) {
    const [iqamahHour, iqamahMinute] = iqamahTime.split(":").map(Number);
    const iqamahTotalMinutes = iqamahHour * 60 + iqamahMinute;

    if (iqamahTotalMinutes - adhanTotalMinutes >= 30) {
      // Format to 12-hour clock
      const hour12 = (iqamahHour % 12 === 0 ? 12 : iqamahHour % 12).toString().padStart(2, "0");
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

function calculateIshaIqamahTime(adhanTime24) {
  // Parse input
  const [hourStr, minuteStr] = adhanTime24.split(":");
  let hour = parseInt(hourStr, 10);
  let minute = parseInt(minuteStr, 10);

  // +7 minute buffer
  let totalMinutes = hour * 60 + minute + 7;

  // Round up to the next 5-minute block
  let remainder = totalMinutes % 5;
  if (remainder !== 0) {
    totalMinutes += 5 - remainder;
  }

  // Cap at 22:45 (10:45 PM)
  const maxMinutes = 22 * 60 + 45;
  if (totalMinutes > maxMinutes) {
    totalMinutes = maxMinutes;
  }

  // Convert back to hour and minute
  let iqamahHour24 = Math.floor(totalMinutes / 60);
  let iqamahMinute = totalMinutes % 60;

  // Convert to 12-hour format
  let iqamahHour12 = iqamahHour24 % 12;
  if (iqamahHour12 === 0) iqamahHour12 = 12;

  return `${iqamahHour12}:${iqamahMinute.toString().padStart(2, "0")}`;
}

// Function to determine Friday prayer time in Canada
const getJumaaPrayerTime = async () => {
  const currentTimeInCanada = DateTime.now().setZone("America/Toronto");

  // If it's daylight saving time, prayer is at 2 PM, otherwise at 1 PM
  const fridayPrayerTime = currentTimeInCanada.isInDST ? "2:00" : "1:00";

  return fridayPrayerTime;
}

// Function to login and get the access token
const login = async () => {
  const response = await fetch('https://awqatsalah.diyanet.gov.tr/Auth/Login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: process.env.DIYANET_EMAIL,
      password: process.env.DIYANET_PASSWORD,
    }),
  });

  const data = await response.json();

  return data.data?.accessToken;
};

// Canada Id: 52
// Ontario Id: 640
// Toronto Id: 9118
// send Get request to the API
const getStates = async (token) => {
    const response = await fetch('https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/9118', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();
    return data;
};

// Eid Prayer Time
const getEidPrayerTime = async (cityId, token) => {
    const res = await fetch(`https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Eid/${cityId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    return data;
}

// Ramadan Prayer Times 
const getRamadanPrayerTimes = async (cityId, token) => {
  const res = await fetch(`https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Ramadan/${cityId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  return data;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Prayer Times API is running.');
});

app.get('/prayer-times', async (req, res) => {
  try {
    const token = await login();
    let result;
    if (token) {
      let prayerTime = await getStates(token);
      let eidPrayerTime = await getEidPrayerTime(9118, token);
      let RamadanPrayerTime = await getRamadanPrayerTimes(9118, token);
      result = {
        cityId: 9118,
        cityName: "Toronto",
        gregorianDate: prayerTime.data[0].gregorianDateShort,
        hijriDate: prayerTime.data[0].hijriDateShort,
        jumaaPrayerTime: await getJumaaPrayerTime(),
        dailyPrayerTimes: [
          { name: "Fajr",    time: prayerTime.data[0].fajr,    iqamah: calculateFajrIqamahFromSunrise(prayerTime.data[0].sunrise) },
          { name: "Sunrise", time: prayerTime.data[0].sunrise },
          { name: "Dhuhr",   time: prayerTime.data[0].dhuhr,   iqamah: await getJumaaPrayerTime() },
          { name: "Asr",     time: prayerTime.data[0].asr,     iqamah: await calculateAsrIqamah(prayerTime.data[0].asr) },
          { name: "Maghrib", time: prayerTime.data[0].maghrib, iqamah: prayerTime.data[0].maghrib.split(":")[0] % 12 + ":" + prayerTime.data[0].maghrib.split(":")[1] },
          { name: "Isha",    time: prayerTime.data[0].isha,    iqamah: await calculateIshaIqamahTime(prayerTime.data[0].isha) },
        ],
        eidPrayerTimes: {
          eidFitr: {
            date:      eidPrayerTime.data.eidAlFitrDate,
            hijriDate: eidPrayerTime.data.eidAlFitrHijri,
            time:      eidPrayerTime.data.eidAlFitrTime,
            firstIqamah: "08:00",
            secondIqamah: "08:30"
          },
          eidAdha: {
            date:      eidPrayerTime.data.eidAlAdhaDate,
            hijriDate: eidPrayerTime.data.eidAlAdhaHijri,
            time:      eidPrayerTime.data.eidAlAdhaTime,
            firstIqamah: "07:00",
            secondIqamah: "07:30"
          }
        },
        RamadanPrayerTimes: RamadanPrayerTime.data,
        success: true,
        message: "Prayer times fetched successfully."
      };
    } else {
      result = {
        success: false,
        message: 'Login failed or token not received.'
      };
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
