import type { Timestamp } from 'firebase/firestore';

export type Sport = 'pickleball' | 'tennis';

/** Occupancy status shown as the Open / Busy / Full pill. */
export type OccupancyStatus = 'open' | 'busy' | 'full';

/** A court location. Stored in the Firestore `courts` collection. */
export interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sports: Sport[];
  numberOfCourts: number;
  surface: string;          // e.g. "Concrete"
  hasLights: boolean;
  hours: string;            // e.g. "6 AM–11 PM daily"
  walkOnRules: string;      // e.g. "Free · 1 hr limit"
  reservationInfo: string;  // e.g. "$3–$5/hr · take priority"
}

/** One check-in. Stored in the Firestore `checkIns` collection. */
export interface CheckIn {
  id?: string;              // Firestore document id (added when read)
  userId: string;
  courtId: string;
  checkedInAt: Timestamp;
  active: boolean;
}

/** Computed from active check-ins. Never stored in Firestore. */
export interface Occupancy {
  playersCheckedIn: number;
  courtsInUse: number;
  status: OccupancyStatus;
  lastUpdated: Date | null;
}