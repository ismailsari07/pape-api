# Fajr Iqamah Time Calculator

This simple JavaScript utility calculates the Fajr iqamah time based on the sunrise time.  
It ensures that the iqamah time is **at least 15 minutes before** the sunrise.

## 📌 Features

- Accepts sunrise time in "HH:mm" (24-hour) format.                                                                 
- Rounds down to the nearest 15-minute block before sunrise.                                                        
- Ensures a **minimum 15-minute gap** between iqamah and sunrise.                                                   
- Returns the iqamah time in "HH:mm" 12-hour format with leading zeros.                                             
                                                                                                                    
---                                                                                                                 
                                                                                                                    
## 🚀 Usage                                                                                                         
                                                                                                                    
```js                                                                                                               
import { calculateFajrIqamahFromSunrise } from './iqamah.js';                                                       
                                                                                                                    
const sunrise = "06:40";                                                                                            
const iqamahTime = calculateFajrIqamahFromSunrise(sunrise);                                                         
                                                                                                                    
console.log("Fajr Iqamah Time:", iqamahTime); // Output: e.g., "06:15"                                              
```                                                                                                                 
                                                                                                                    
---                                                                                                                 
                                                                                                                    
## 🧠 Logic                                                                                                         
                                                                                                                    
1. Convert `sunriseTime` (e.g., "06:40") to total minutes from midnight.                                            
2. Round down to the **nearest 15-minute block before sunrise**.
3. If the time difference is less than 15 minutes, subtract **another 15 minutes**.
4. Convert back to 12-hour format and return.

---

## 📄 Example Results

| Sunrise | Iqamah |
|---------|--------|
| 06:10   | 05:45  |
| 06:30   | 06:15  |
| 06:40   | 06:15  |
| 06:50   | 06:30  |

---

## 📁 File Structure

```
/your-project
  ├── iqamah.js         // Contains the calculation function
  ├── index.js          // Sample usage (optional)
  └── README.md         // This file
```

---

## 🛠 Requirements

- Node.js (any recent version)
- Pure JavaScript, no external libraries needed

---

## 🧾 License

This project is free to use and modify.
