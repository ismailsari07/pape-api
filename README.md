📂 README.md
markdown
Copy
Edit
# 🕌 Prayer Times & Iqamah Scheduler (Toronto, Canada 🇨🇦)

This Node.js project fetches daily Islamic prayer times from [Diyanet's](https://awqatsalah.diyanet.gov.tr) official API and calculates iqamah times (congregational prayer times) for a specific city: **Toronto, Canada**.

---

## 🚀 Features

- ✅ **Fajr iqamah**: Automatically calculated based on sunrise time with safety buffer.
- ✅ **Asr iqamah**: Chosen from a predefined set of valid iqamah times (minimum 30 minutes after adhan).
- ✅ **Isha iqamah**: Smart rounding + cap limit at 10:45 PM.
- ✅ **Jumaa (Friday) prayer**: Automatically adjusts to daylight saving time (DST).
- ✅ Supports **Eid** and **Ramadan** special prayer times.

---

## 📦 Tech Stack

- [Node.js](https://nodejs.org)
- [node-fetch](https://www.npmjs.com/package/node-fetch)
- [Luxon](https://moment.github.io/luxon) – for timezone and DST handling

---

## ⚙️ Setup & Usage

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/prayer-times-iqamah.git
cd prayer-times-iqamah
Install dependencies:

bash
Copy
Edit
npm install
Run the script:

bash
Copy
Edit
node index.js
🔑 Auth & API
This app connects to Diyanet’s Prayer Time API using credentials. Ensure that the correct email and password are provided inside the login() function.

⚠️ For production use, do not hardcode credentials. Use environment variables or a config file.

📐 Iqamah Calculation Logic
🕓 Fajr
Based on sunrise time

Rounded down to nearest 20-minute block

Ensures ≥20 minutes gap between iqamah and sunrise

🕔 Asr
Chosen from a whitelist: 15:00, 15:30, 16:30, etc.

Only picks times ≥30 minutes after Asr adhan

🌙 Isha
Adds 7-minute buffer to adhan

Rounds up to nearest 5-minute block

Capped at 10:45 PM

📿 Jumaa
2:00 PM if daylight saving is active, otherwise 1:00 PM

🌙 Eid & Ramadan Support
Eid prayer time can be fetched via /PrayerTime/Eid/{cityId}

Ramadan times are available via /PrayerTime/Ramadan/{cityId}

📍 Location IDs
Location	ID
Canada	52
Ontario	640
Toronto	9118

📄 Example Output
json
Copy
Edit
{
  "cityId": 9118,
  "cityName": "Toronto",
  "gregorianDate": "2025-05-29",
  "hijriDate": "1446-11-01",
  "jumaaPrayerTime": "2:00",
  "dailyPrayerTimes": [
    { "name": "Fajr",    "time": "04:15", "iqamah": "04:40" },
    { "name": "Sunrise", "time": "05:55" },
    { "name": "Dhuhr",   "time": "13:10", "iqamah": "2:00" },
    { "name": "Asr",     "time": "17:10", "iqamah": "5:45" },
    { "name": "Maghrib", "time": "20:30", "iqamah": "8:30" },
    { "name": "Isha",    "time": "22:00", "iqamah": "10:10" }
  ]
}
📬 Contact
For questions or improvements:

Email: xismail.sari@gmail.cm

GitHub: github.com/ismailsari07