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
  useIonRouter,
  IonToast,
} from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import CourtMap, { CourtMapItem } from "../components/CourtMap";
import { useAuth } from "../hooks/useAuth";
import { useLiveCourtData } from "../hooks/useLiveCourtData";
import { logout } from "../services/auth";
import { CheckinService, type ActiveCheckIn } from "../services/CheckinService";
import { CourtService } from "../services/CourtService";
import type { Court, Sport } from "../types/types";
import CourtFilterSheet from "../components/CourtFilterSheet";
import { useCourtFilters } from "../hooks/useCourtFilters";
import {
  activeFilterChips,
  buildRows,
  clearFilters,
} from "../utils/courtFilters";
import { courtSummary } from "../utils/courts";
import { formatDistance } from "../utils/geo";
import "./CourtsPage.css";

const CourtsPage: React.FC = () => {
  const ionRouter = useIonRouter();
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
  const [filters, changeFilters] = useCourtFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toastMessage, setToastMessage] = useState("");
  const gotLocation = useRef(false);
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
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
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
          return;
        }

        if (position && !isDisposed) {
          gotLocation.current = true;
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

  const hasLocation = userLocation !== null;
  const rows = useMemo(
    () => buildRows(courts, sport, filters, activity, userLocation, now),
    [courts, sport, filters, activity, userLocation, now],
  );
  const chips = activeFilterChips(filters, hasLocation);
  const sportName = sport === "tennis" ? "tennis" : "pickleball";

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
      ionRouter.push("/login", "root", "replace");
      await logout();
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
              <IonSegmentButton value="pickleball">
                <IonLabel>Pickleball</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="tennis">
                <IonLabel>Tennis</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </div>

          <div className="courts-page__map">
            <CourtMap
              items={items}
              userLocation={userLocation}
              fitToItems={chips.length > 0}
            />
          </div>

          <section
            className="courts-page__list"
            aria-labelledby="nearby-courts-heading"
          >
            <div className="courts-page__list-header">
              <h2 id="nearby-courts-heading" className="pc-section-heading">
                {chips.length > 0
                  ? `${rows.length} of ${courts.length} courts`
                  : `${rows.length} ${sportName} ${rows.length === 1 ? "court" : "courts"}`}
              </h2>
              <div className="courts-page__list-actions">
                {chips.length > 0 && (
                  <button
                    type="button"
                    className="courts-page__link"
                    onClick={() => changeFilters(clearFilters)}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className={`courts-chip courts-chip--filter${chips.length > 0 ? " courts-chip--on" : ""}`}
                  onClick={() => setSheetOpen(true)}
                >
                  {chips.length > 0
                    ? `Filter courts · ${chips.length}`
                    : "Filter courts"}
                </button>
              </div>
            </div>
            {!userLocation && (
              <p className="courts-page__location-note">
                Allow location access to sort courts by distance.
              </p>
            )}
            {rows.length === 0 && chips.length > 0 && (
              <div className="courts-page__empty">
                <p>No courts match</p>
                <IonButton
                  size="small"
                  fill="outline"
                  onClick={() => changeFilters(clearFilters)}
                >
                  Clear filters
                </IonButton>
              </div>
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
                    <p>
                      {distance === null
                        ? ""
                        : `${formatDistance(distance)} · `}
                      {courtSummary(court)}
                    </p>
                    <p>{court.address}</p>
                  </IonLabel>
                  <div className="courts-page__live" slot="end">
                    <span
                      className={
                        reported !== null
                          ? "courts-page__activity courts-page__activity--active"
                          : "courts-page__activity"
                      }
                    >
                      {reported === null
                        ? "No reports"
                        : `${reported} reported`}
                    </span>
                    {openGames > 0 && (
                      <span className="courts-page__games">
                        {`${openGames} open ${openGames === 1 ? "game" : "games"}`}
                      </span>
                    )}
                  </div>
                </IonItem>
              ))}
            </IonList>
          </section>
        </div>
      </IonContent>
      <CourtFilterSheet
        isOpen={sheetOpen}
        filters={filters}
        resultCount={rows.length}
        hasLocation={hasLocation}
        onChange={changeFilters}
        onClose={() => setSheetOpen(false)}
      />
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
