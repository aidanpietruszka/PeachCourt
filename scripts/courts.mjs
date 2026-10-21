const mk = (id, name, address, latitude, longitude, sports, numberOfCourts,
  surface, hasLights, hours, walkOnRules, reservationInfo) => ({
  id, name, address, latitude, longitude, sports, numberOfCourts,
  surface, hasLights, hours, walkOnRules, reservationInfo,
});

const T = ['tennis'];
const P = ['pickleball'];
const TP = ['tennis', 'pickleball'];
const FREE = 'Free · first come, first served';

export const COURTS = [
  mk('georgia-tech-courts', 'Georgia Tech Campus Courts', 'Georgia Tech Campus, Atlanta, GA 30332', 33.7788, -84.4048, TP, 6, 'Hard', true, '7 AM–10 PM daily', 'Georgia Tech affiliates only', 'None') // test
];