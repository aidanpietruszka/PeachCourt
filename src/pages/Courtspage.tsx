import { useEffect, useMemo, useRef, useState } from "react";
import {
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonToast,
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  type QueryDocumentSnapshot,
  where,
} from "firebase/firestore";
import CourtMap, { CourtMapItem } from "../components/CourtMap";
import { CourtService } from "../services/CourtService";
import { db } from "../services/firebase";
import type { Court, Sport } from "../types/types.ts";
import "./Courtspage.css";

function distanceBetweenMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) *
      Math.cos(radians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 0.1
    ? `${Math.max(1, Math.round(meters * 3.28084))} ft`
    : `${miles.toFixed(1)} mi`;
}

const CourtsPage: React.FC = () => {
  const [sport, setSport] = useState<Sport>("pickleball");
  const [courts, setCourts] = useState<Court[]>([]);
  const [playersByCourt, setPlayersByCourt] = useState<Record<string, number>>(
    {},
  );
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState("");
  const hasLocation = useRef(false);

  useEffect(() => {
    return CourtService.subscribeToCourts(setCourts, (error) => {
      console.error("Unable to load courts", error);
      setToastMessage("Courts are unavailable right now.");
    });
  }, []);

  useEffect(() => {
    const activeCheckinsQuery = query(
      collection(db, "checkins"),
      where("active", "==", true),
    );
    let latestDocs: QueryDocumentSnapshot[] = [];
    const recalculateCounts = () => {
      const now = Date.now();
      const counts: Record<string, number> = {};
      latestDocs.forEach((snapshot) => {
        const checkin = snapshot.data();
        const arrival =
          checkin.scheduledArrivalAt instanceof Timestamp
            ? checkin.scheduledArrivalAt
            : checkin.checkedInAt;
        if (
          arrival instanceof Timestamp &&
          arrival.toMillis() <= now &&
          checkin.expiresAt instanceof Timestamp &&
          checkin.expiresAt.toMillis() > now &&
          typeof checkin.courtId === "string" &&
          typeof checkin.playerCount === "number"
        ) {
          counts[checkin.courtId] =
            (counts[checkin.courtId] ?? 0) + checkin.playerCount;
        }
      });
      setPlayersByCourt(counts);
    };

    const unsubscribe = onSnapshot(
      activeCheckinsQuery,
      (snapshots) => {
        latestDocs = snapshots.docs;
        recalculateCounts();
      },
      (error) => {
        console.error("Unable to load live check-in counts", error);
        setToastMessage("Live player counts are unavailable right now.");
      },
    );
    const expiryTimer = window.setInterval(recalculateCounts, 5_000);

    return () => {
      unsubscribe();
      window.clearInterval(expiryTimer);
    };
  }, []);

  useEffect(() => {
    let isDisposed = false;
    let watchId: string | undefined;

    void Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
        minimumUpdateInterval: 5_000,
      },
      (position, error) => {
        if (error) {
          console.warn("Unable to update device location", error);
          if (!isDisposed && !hasLocation.current) {
            setToastMessage(
              "Your location is unavailable. Allow location access to show your blue map pin.",
            );
          }
          return;
        }

        if (position && !isDisposed) {
          hasLocation.current = true;
          setUserLocation([
            position.coords.latitude,
            position.coords.longitude,
          ]);
        }
      },
    )
      .then((id) => {
        if (isDisposed) {
          void Geolocation.clearWatch({ id }).catch((error: unknown) => {
            console.error("Unable to stop the location watcher", error);
          });
        } else {
          watchId = id;
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to start device location updates", error);
        if (!isDisposed) {
          setToastMessage(
            "Your location is unavailable. Allow location access to show your blue map pin.",
          );
        }
      });

    return () => {
      isDisposed = true;
      if (watchId) {
        void Geolocation.clearWatch({ id: watchId }).catch((error: unknown) => {
          console.error("Unable to stop the location watcher", error);
        });
      }
    };
  }, []);

  const items: CourtMapItem[] = useMemo(
    () =>
      courts
        .filter((court) => court.sports.includes(sport))
        .map((court) => ({
          court,
          players: playersByCourt[court.id] ?? 0,
          status: "open",
        })),
    [courts, sport, playersByCourt],
  );

  const nearbyCourts = useMemo(() => {
    const sportCourts = courts
      .filter((court) => court.sports.includes(sport))
      .map((court) => ({
        court,
        distance: userLocation
          ? distanceBetweenMeters(
              userLocation[0],
              userLocation[1],
              court.latitude,
              court.longitude,
            )
          : null,
      }));

    if (userLocation) {
      sportCourts.sort(
        (first, second) => (first.distance ?? 0) - (second.distance ?? 0),
      );
    }

    return sportCourts;
  }, [courts, sport, userLocation]);

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="courts-page">
          <div className="pc-screen courts-page__header">
            <h1 className="pc-title">Courts near you</h1>
            <p className="pc-subtitle">Near Piedmont Park, Midtown Atlanta</p>

            <IonSegment
              value={sport}
              onIonChange={(event) => setSport(event.detail.value as Sport)}
              className="courts-page__segment"
            >
              <IonSegmentButton value="pickleball">
                <IonLabel>Pickleball</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="tennis">
                <IonLabel>Tennis</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </div>

          <div className="courts-page__map">
            <CourtMap items={items} userLocation={userLocation} />
          </div>

          <section
            className="courts-page__list"
            aria-labelledby="nearby-courts-heading"
          >
            <h2 id="nearby-courts-heading" className="pc-section-heading">
              Nearby courts
            </h2>
            {!userLocation && (
              <p className="courts-page__location-note">
                Allow location access to sort courts by distance.
              </p>
            )}
            <IonList inset>
              {nearbyCourts.map(({ court, distance }) => (
                <IonItem
                  key={court.id}
                  button
                  detail
                  routerLink={`/courts/${court.id}`}
                  routerDirection="forward"
                >
                  <IonLabel>
                    <h3>{court.name}</h3>
                    <p>{court.address}</p>
                    <p>
                      {court.numberOfCourts} courts ·{" "}
                      {court.sports
                        .map((courtSport) =>
                          courtSport === "pickleball" ? "Pickleball" : "Tennis",
                        )
                        .join(", ")}
                    </p>
                  </IonLabel>
                  <IonText slot="end" className="courts-page__distance">
                    {distance === null ? "—" : formatDistance(distance)}
                  </IonText>
                </IonItem>
              ))}
            </IonList>
          </section>
        </div>
      </IonContent>
      <IonToast
        isOpen={toastMessage.length > 0}
        message={toastMessage}
        duration={4000}
        onDidDismiss={() => setToastMessage("")}
      />
    </IonPage>
  );
};

export default CourtsPage;
