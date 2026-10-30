const mk = (
  id,
  name,
  address,
  latitude,
  longitude,
  sports,
  numberOfCourts,
  surface,
  hasLights,
  hours,
  walkOnRules,
  reservationInfo,
) => ({
  id,
  name,
  address,
  latitude,
  longitude,
  sports,
  numberOfCourts,
  surface,
  hasLights,
  hours,
  walkOnRules,
  reservationInfo,
});

const T = ["tennis"];
const P = ["pickleball"];
const TP = ["tennis", "pickleball"];
const FREE = "Free · first come, first served";

export const COURTS = [
  mk(
    "ken-byers-tennis-complex",
    "Ken Byers Tennis Complex",
    "Fowler Street Northwest at 10th Street, Atlanta, GA 30332",
    33.780684,
    -84.394465,
    T,
    10,
    "Hard",
    true,
    "Mon–Fri 5 PM–10 PM · Sat 10 AM–2 PM",
    "Members only",
    "Georgia Tech students only (BuzzCard); 4 of 10 courts; no reservations",
  ),
];
