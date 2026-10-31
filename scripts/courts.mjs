const mk = (
  id,
  name,
  address,
  latitude,
  longitude,
  hasLights,
  walkOnRules,
  reservationInfo,
) => ({
  id,
  name,
  address,
  latitude,
  longitude,
  hasLights,
  walkOnRules,
  reservationInfo,
});

export const COURTS = [
  mk(
    "ken-byers-tennis-complex",
    "Ken Byers Tennis Complex",
    "Fowler Street Northwest at 10th Street, Atlanta, GA 30332",
    33.780684,
    -84.394465,
    true,
    "Members only",
    "Georgia Tech students only (BuzzCard); 4 of 10 courts; no reservations",
  ),
];
