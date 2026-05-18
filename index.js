// import fetch module
import express from "express";
import dotenv from "dotenv";
import { login, getStates, getEidPrayerTime, getRamadanPrayerTimes, } from "./lib/apiClient.js";
import { calculateFajrIqamahFromSunrise, calculateAsrIqamah, calculateIshaIqamahTime, getJumaaPrayerTime, } from "./lib/calculatePrayerTimes.js";
import { convertTime, generateIqamaChangeNotices } from "./lib/utils.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Prayer Times API is running.");
});

app.get("/prayer-times", async (req, res) => {
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
          {
            name: "Fajr",
            time: prayerTime.data[0].fajr,
            iqamah: calculateFajrIqamahFromSunrise(prayerTime.data[0].sunrise),
          },
          { name: "Sunrise", time: prayerTime.data[0].sunrise },
          {
            name: "Dhuhr",
            time: convertTime(prayerTime.data[0].dhuhr),
            iqamah: await getJumaaPrayerTime(),
          },
          {
            name: "Asr",
            time: convertTime(prayerTime.data[0].asr),
            iqamah: await calculateAsrIqamah(prayerTime.data[0].asr),
          },
          {
            name: "Maghrib",
            time: convertTime(prayerTime.data[0].maghrib),
            iqamah: convertTime(prayerTime.data[0].maghrib)
          },
          {
            name: "Isha",
            time: convertTime(prayerTime.data[0].isha),
            iqamah: await calculateIshaIqamahTime(prayerTime.data[0].isha),
          },
        ],
        notices: [],
        eidPrayerTimes: {
          eidFitr: {
            date: eidPrayerTime.data.eidAlFitrDate,
            hijriDate: eidPrayerTime.data.eidAlFitrHijri,
            time: eidPrayerTime.data.eidAlFitrTime,
            firstIqamah: "08:00",
            secondIqamah: "08:30",
          },
          eidAdha: {
            date: eidPrayerTime.data.eidAlAdhaDate,
            hijriDate: eidPrayerTime.data.eidAlAdhaHijri,
            time: eidPrayerTime.data.eidAlAdhaTime,
            firstIqamah: "07:00",
            secondIqamah: "07:30",
          },
        },
        RamadanPrayerTimes: RamadanPrayerTime.data,
        success: true,
        message: "Prayer times fetched successfully.",
      };

      result.notices = await generateIqamaChangeNotices(result.dailyPrayerTimes, token);
    } else {
      result = {
        success: false,
        message: "Login failed or token not received.",
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
