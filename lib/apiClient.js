import fetch from "node-fetch";

// Function to login an
export async function login() {
  const response = await fetch("https://awqatsalah.diyanet.gov.tr/Auth/Login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // email: process.env.DIYANET_EMAIL,
      // password: process.env.DIYANET_PASSWORD,
      email: 'xismail.sari@gmail.com',
      password: 'b%K20j+D', 
    }),
  });

  const data = await response.json();

  return data.data?.accessToken;
};

// Canada Id: 52
// Ontario Id: 640
// Toronto Id: 9118
// send Get request to the API
export async function getStates(token) {
  const response = await fetch(
    "https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/9118",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const data = await response.json();
  return data;
};

export async function getWeeklyPrayerTimes(token) {
  const response = await fetch(
    "https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Weekly/9118",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const data = await response.json();
  return data;
};

// Eid Prayer Time
export async function getEidPrayerTime(cityId, token) {
  const res = await fetch(
    `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Eid/${cityId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const data = await res.json();

  return data;
};

// Ramadan Prayer Times
export async function getRamadanPrayerTimes (cityId, token) {
  const res = await fetch(
    `https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Ramadan/${cityId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const data = await res.json();

  return data;
};
