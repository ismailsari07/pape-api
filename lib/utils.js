import { calculateFajrIqamahFromSunrise, calculateAsrIqamah, calculateIshaIqamahTime, getJumaaPrayerTime, } from "./calculatePrayerTimes.js";
import { getWeeklyPrayerTimes } from "./apiClient.js";

export function convertTime(time) {
    let hours = parseInt(time.substring(0, 2));
    let minutes = time.substring(3, 5);
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return hours + ':' + minutes;
}

export async function generateIqamaChangeNotices(prayerTimes, token) {
    let notices = [];
    let weeklyTimes = await getWeeklyPrayerTimes(token);
    let tomorrowsTimes = weeklyTimes.data[2]; 

    let fajrIqamaForTomorrow = calculateFajrIqamahFromSunrise(tomorrowsTimes.sunrise);  
    let dhuhrIqamaForTomorrow = await getJumaaPrayerTime();
    let asrIqamaForTomorrow = await calculateAsrIqamah(tomorrowsTimes.asr);
    let ishaIqamaForTomorrow = await calculateIshaIqamahTime(tomorrowsTimes.isha);

    if (prayerTimes[0].iqamah !== fajrIqamaForTomorrow) {
        notices.push(`* Starting from tomorrow, Fajr will begin at ${fajrIqamaForTomorrow} a.m.`);
    }
    if (prayerTimes[2].iqamah !== dhuhrIqamaForTomorrow) {
        notices.push(`* Starting from tomorrow, Dhuhr will begin at ${dhuhrIqamaForTomorrow} p.m.`);
    }
    if (prayerTimes[3].iqamah !== asrIqamaForTomorrow) {
        notices.push(`* Starting from tomorrow, Asr will begin at ${asrIqamaForTomorrow} p.m.`);
    }
    if (prayerTimes[5].iqamah !== ishaIqamaForTomorrow) {
        notices.push(`* Starting from tomorrow, Isha will begin at ${ishaIqamaForTomorrow} p.m.`);
    }

    return notices;
}