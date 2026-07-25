// import fetch module
import express from "express";
import dotenv from "dotenv";
import { login, getStates, getEidPrayerTime, getRamadanPrayerTimes, getWeeklyPrayerTimes, createSession, createDeadline, UpstreamError, NETWORK_ERROR_CODES, } from "./lib/apiClient.js";
import { calculateFajrIqamahFromSunrise, calculateAsrIqamah, calculateIshaIqamahTime, getJumaaPrayerTime, } from "./lib/calculatePrayerTimes.js";
import { convertTime, generateIqamaChangeNotices } from "./lib/utils.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const CITY_ID = 9118;
// Whole-request budget: fail fast and predictably instead of hanging toward
// whatever timeout the caller (Vercel cron) enforces.
const REQUEST_DEADLINE_MS = 25000;

/**
 * Maps an error onto an unambiguous status code:
 *   504 - connection-level failure or timeout (nothing usable came back)
 *   502 - Diyanet answered, but with an error or an unusable body
 *   500 - our own misconfiguration or bug, not Diyanet's fault
 */
function statusForError(error) {
  const code = error instanceof UpstreamError ? error.code : null;

  if (!code || code === "INTERNAL_ERROR") return 500;
  if (code === "MISSING_CREDENTIALS") return 500;
  if (code === "DEADLINE_EXCEEDED" || NETWORK_ERROR_CODES.has(code)) return 504;

  // UPSTREAM_HTTP_ERROR, INVALID_JSON, LOGIN_NO_TOKEN
  return 502;
}

function respondWithError(res, error) {
  const isUpstream = error instanceof UpstreamError;

  res.status(statusForError(error)).json({
    success: false,
    code: isUpstream ? (error.code ?? "UPSTREAM_ERROR") : "INTERNAL_ERROR",
    upstreamLabel: isUpstream ? (error.label ?? null) : null,
    attempts: isUpstream ? (error.attempts ?? null) : null,
    status: isUpstream ? (error.status ?? null) : null,
    message: error?.message ?? String(error),
  });
}

app.get("/", (req, res) => {
  res.send("Prayer Times API is running.");
});

app.get("/prayer-times", async (req, res) => {
  const deadline = createDeadline(REQUEST_DEADLINE_MS);

  try {
    const token = await login(deadline);
    if (!token) {
      throw new UpstreamError("Login failed or token not received.", {
        label: "Auth/Login",
        code: "LOGIN_NO_TOKEN",
      });
    }

    const session = createSession(token, deadline);

    // The four data calls are independent, so they go out together. allSettled
    // (rather than all) means every failure gets logged and none are left
    // running unobserved when a sibling rejects first.
    const [dailyResult, eidResult, ramadanResult, weeklyResult] =
      await Promise.allSettled([
        getStates(session, deadline),
        getEidPrayerTime(CITY_ID, session, deadline),
        getRamadanPrayerTimes(CITY_ID, session, deadline),
        getWeeklyPrayerTimes(session, deadline),
      ]);

    // Report the most load-bearing failure, but surface all of them in the logs.
    const byPriority = [
      ["PrayerTime/Daily", dailyResult],
      ["PrayerTime/Weekly", weeklyResult],
      ["PrayerTime/Eid", eidResult],
      ["PrayerTime/Ramadan", ramadanResult],
    ];
    const failures = byPriority.filter(([, r]) => r.status === "rejected");

    if (failures.length > 0) {
      for (const [label, result] of failures) {
        console.error(
          `[prayer-times] ${label} failed permanently: ${result.reason?.message ?? result.reason}`,
        );
      }
      // Phase 2 (last-known-good cache) will degrade per-field here instead.
      throw failures[0][1].reason;
    }

    const prayerTime = dailyResult.value;
    const eidPrayerTime = eidResult.value;
    const RamadanPrayerTime = ramadanResult.value;

    const result = {
      cityId: CITY_ID,
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

    result.notices = await generateIqamaChangeNotices(result.dailyPrayerTimes, weeklyResult.value);

    res.json(result);
  } catch (error) {
    // Log the full error (including stack) before it becomes a JSON response,
    // so upstream failures are visible in this service's own logs.
    console.error("[prayer-times] request failed:", error);
    respondWithError(res, error);
  } finally {
    deadline.clear();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
