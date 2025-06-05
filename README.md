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

## ⚙ Setup & Usage  

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/prayer-times-iqamah.git
cd prayer-times-iqamah
```

2. **Install dependencies:**

```bash
npm install
```

3. **Run the script:**

```bash
node index.js
```

---

## 🔑 Auth & API

This app connects to [Diyanet’s Prayer Time API](https://awqatsalah.diyanet.gov.tr/) using credentials. Ensure that the correct `email` and `password` are provided inside the `login()` function.

> ⚠ For production use, **do not hardcode credentials**. Use environment variables or a config file.

---

## 📐 Iqamah Calculation Logic

### 🕓 Fajr
- Based on **sunrise time**
- Rounded down to nearest **20-minute block**
- Ensures **≥20 minutes** gap between iqamah and sunrise

### 🕔 Asr
- Chosen from a whitelist: `15:00, 15:15, 15:30, ..., 18:00`
- Must be at least **30 minutes after adhan time**

### 🕘 Isha
- Rounded up to the nearest **15-minute** block
- Capped at **10:45 PM** maximum

### 🕌 Jumaa
- Dynamic: 
  - During **DST**: 1:30 PM
  - Outside **DST**: 12:30 PM

---

## 📅 Output

Final iqamah times are printed in the console and can be adapted for web or display systems. Add your preferred formatting or file writing as needed.

---

## 📜 License

MIT License – free for personal or community mosque use.
