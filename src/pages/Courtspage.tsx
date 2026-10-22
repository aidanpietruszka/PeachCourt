import { useEffect, useMemo, useRef, useState } from "react";
import {
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonToast,
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import { useNavigate } from "react-router-dom";
import CourtMap, { CourtMapItem } from "../components/CourtMap";
import { useAuth } from "../components/useAuth";
import {
  EMPTY_ACTIVITY,
  useLiveCourtData,
} from "../components/useLiveCourtData";
import { logout } from "../services/auth";
import { CheckinService, type ActiveCheckIn } from "../services/CheckinService";
import { CourtService } from "../services/CourtService";
import type { Court, Sport } from "../types/types.ts";
import {
  distanceBetweenMeters,
  formatActivity,
  formatDistance,
} from "../utils/geo";
import "./Courtspage.css";

const CourtsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [sport, setSport] = useState<Sport>("tennis");
  const [courts, setCourts] = useState<Court[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(
    null,
  );
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const hasLocation = useRef(false);
  const activity = useLiveCourtData();

  useEffect(() => {
    return CourtService.subscribeToCourts(setCourts, (error) => {
      console.error("Unable to load courts", error);
      setToastMessage("Courts are unavailable right now.");
    });
  }, []);

  useEffect(() => {
    if (!uid) {
      setActiveCheckIn(null);
      return;
    }
    return CheckinService.subscribeToActiveCheckIn(
      uid,
      setActiveCheckIn,
      (error) => {
        console.error("Unable to load your active check-in", error);
      },
    );
  }, [uid]);

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

  const rows = useMemo(() => {
    const sportCourts = courts
      .filter((court) => court.sports.includes(sport))
      .map((court) => {
        const courtActivity = activity[court.id] ?? EMPTY_ACTIVITY;
        return {
          court,
          reported: courtActivity.reported,
          openGames: courtActivity.openGames,
          distance: userLocation
            ? distanceBetweenMeters(
                userLocation[0],
                userLocation[1],
                court.latitude,
                court.longitude,
              )
            : null,
        };
      });

    return sportCourts.sort((first, second) => {
      if (first.distance !== null && second.distance !== null) {
        return first.distance - second.distance;
      }
      const activityDifference =
        (second.reported ?? 0) +
        second.openGames -
        ((first.reported ?? 0) + first.openGames);
      return activityDifference !== 0
        ? activityDifference
        : first.court.name.localeCompare(second.court.name);
    });
  }, [courts, sport, activity, userLocation]);

  const items: CourtMapItem[] = rows.map(({ court, reported, openGames }) => ({
    court,
    reported,
    openGames,
  }));

  const checkedInCourt = activeCheckIn
    ? courts.find((court) => court.id === activeCheckIn.courtId)
    : undefined;

  const handleCheckOut = async () => {
    setIsBusy(true);
    try {
      await CheckinService.checkOut();
      setToastMessage("You are checked out.");
    } catch (error) {
      console.error("Unable to check out", error);
      setToastMessage(
        `Check-out failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Unable to log out", error);
      setToastMessage("Log out failed. Please try again.");
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="courts-page">
          <div className="pc-screen courts-page__header">
            <div className="courts-page__title-row">
              <h1 className="pc-title">Courts near you</h1>
              <IonButton
                fill="clear"
                size="small"
                onClick={() => void handleLogout()}
              >
                Log out
              </IonButton>
            </div>
            <p className="pc-subtitle">Atlanta</p>

            {activeCheckIn && (
              <div className="courts-page__checked-in">
                <span>Checked in at {checkedInCourt?.name ?? "a court"}</span>
                <IonButton
                  size="small"
                  fill="outline"
                  disabled={isBusy}
                  onClick={() => void handleCheckOut()}
                >
                  Check out
                </IonButton>
              </div>
            )}

            <IonSegment
              value={sport}
              onIonChange={(event) => setSport(event.detail.value as Sport)}
              className="courts-page__segment"
            >
              <IonSegmentButton value="tennis">
                <IonLabel>Tennis</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="pickleball">
                <IonLabel>Pickleball</IonLabel>
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
              {userLocation ? "Nearest courts" : "Most active courts"}
            </h2>
            {!userLocation && (
              <p className="courts-page__location-note">
                Allow location access to sort courts by distance.
              </p>
            )}
            <IonList inset>
              {rows.map(({ court, reported, openGames, distance }) => (
                <IonItem
                  key={court.id}
                  button
                  detail
                  routerLink={`/courts/${court.id}`}
                  routerDirection="forward"
                >
                  <IonLabel>
                    <h3>{court.name}</h3>
                    <p
                      className={
                        reported !== null || openGames > 0
                          ? "courts-page__activity courts-page__activity--active"
                          : "courts-page__activity"
                      }
                    >
                      {distance === null
                        ? ""
                        : `${formatDistance(distance)} · `}
                      {formatActivity(reported, openGames)}
                    </p>
                    <p>
                      {court.numberOfCourts} courts · {court.address}
                    </p>
                  </IonLabel>
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
