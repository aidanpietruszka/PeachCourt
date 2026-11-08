import { useEffect, useState } from "react";
import { IonContent, IonModal, IonPage, useIonRouter } from "@ionic/react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import { useMyActivityGames } from "../hooks/useMyActivityGames";
import { useMyCheckins } from "../hooks/useMyCheckins";
import { CheckinService, type ActiveCheckIn } from "../services/CheckinService";
import { CROWD_RANGES, CROWD_RANGE_MINS, type RangeMin } from "../utils/crowdRange";
import { formatStart } from "../utils/time";
import type { MatchFormat, Sport } from "../types/types";
import type { MyActivityGame } from "../services/MatchService";
import "./MyActivityPage.css";

const SPORT_LABEL: Record<Sport, string> = { pickleball: "Pickleball", tennis: "Tennis" };
const FORMAT_LABEL: Record<MatchFormat, string> = { singles: "Singles", doubles: "Doubles" };

function formatDuration(
  checkedInAtMs: number,
  checkedOutAtMs: number | null,
  expiresAtMs: number,
): string {
  const endMs = checkedOutAtMs ?? expiresAtMs;
  const minutes = Math.round((endMs - checkedInAtMs) / 60_000);
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.max(1, minutes)} min`;
}

function formatCheckinDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

function countText(playerCount: number): string {
  const range = CROWD_RANGES.find(
    (r) => r.min === (CROWD_RANGE_MINS.includes(playerCount as RangeMin) ? playerCount : undefined),
  );
  return range ? (range.min === 1 ? range.label : range.countText) : String(playerCount);
}

function minAgo(ms: number): string {
  const diff = Math.round((Date.now() - ms) / 60_000);
  return `${Math.max(0, diff)} min ago`;
}

function GameRow({ game, uid, onTap }: { game: MyActivityGame; uid: string; onTap: () => void }) {
  const now = Date.now();
  const isUpcoming = game.startAt > now;
  const isHosting = game.hostUid === uid;
  const filled = 1 + game.playerUids.length;
  const total = 1 + game.spotsTotal;

  const title = `${FORMAT_LABEL[game.format]} · ${SPORT_LABEL[game.sport]}`;
  const subtitle = isUpcoming
    ? `${game.courtName} · ${formatStart(new Date(game.startAt), now)} · ${filled} of ${total}`
    : `${game.courtName} · ${formatCheckinDate(game.startAt)}`;

  let pillLabel: string;
  let pillClass: string;
  if (isUpcoming) {
    pillLabel = isHosting ? "Hosting" : "Joined";
    pillClass = isHosting ? "my-activity__pill--hosting" : "my-activity__pill--joined";
  } else {
    pillLabel = "Played";
    pillClass = "my-activity__pill--played";
  }

  return (
    <button
      type="button"
      className={`my-activity__row${isUpcoming ? "" : " my-activity__row--past"}`}
      onClick={onTap}
    >
      <div className="my-activity__row-body">
        <p className="my-activity__row-title">{title}</p>
        <p className="my-activity__row-sub">{subtitle}</p>
      </div>
      <span className={`my-activity__pill ${pillClass}`}>{pillLabel}</span>
    </button>
  );
}

const MyActivityPage: React.FC = () => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [activeCheckin, setActiveCheckin] = useState<ActiveCheckIn | null>(null);
  const [checkinCourtName, setCheckinCourtName] = useState<string>("");
  const [segment, setSegment] = useState<"games" | "checkins">("games");
  const [showUpdateSheet, setShowUpdateSheet] = useState(false);
  const [selectedCount, setSelectedCount] = useState<RangeMin>(1);
  const [isSaving, setIsSaving] = useState(false);

  const games = useMyActivityGames(uid);
  const checkins = useMyCheckins(uid);

  const now = Date.now();
  const upcoming = [...games]
    .filter((g) => g.startAt > now)
    .sort((a, b) => a.startAt - b.startAt);
  const previousGames = [...games]
    .filter((g) => g.startAt <= now)
    .sort((a, b) => b.startAt - a.startAt);

  const isEmpty = !activeCheckin && games.length === 0 && checkins.length === 0;

  useEffect(() => {
    if (!uid) return;
    return CheckinService.subscribeToActiveCheckIn(uid, setActiveCheckin, (err) => {
      console.error("Unable to load active check-in", err);
    });
  }, [uid]);

  useEffect(() => {
    if (!activeCheckin?.courtId) {
      setCheckinCourtName("");
      return;
    }
    void getDoc(doc(db, "courts", activeCheckin.courtId)).then((snap) => {
      setCheckinCourtName((snap.data()?.name as string | undefined) ?? "");
    });
  }, [activeCheckin?.courtId]);

  useEffect(() => {
    if (activeCheckin) {
      setSelectedCount(
        CROWD_RANGE_MINS.includes(activeCheckin.playerCount as RangeMin)
          ? (activeCheckin.playerCount as RangeMin)
          : 1,
      );
    }
  }, [activeCheckin]);

  const handleUpdateCount = async () => {
    if (!activeCheckin || isSaving) return;
    setIsSaving(true);
    try {
      await CheckinService.updateCount(activeCheckin.courtId, selectedCount);
      setShowUpdateSheet(false);
    } catch (err: unknown) {
      console.error("Unable to update count", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckOut = () => {
    void CheckinService.checkOut().catch((err: unknown) => {
      console.error("Unable to check out", err);
    });
  };

  const expiresTime = activeCheckin
    ? activeCheckin.expiresAt.toDate().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const checkinMethod = activeCheckin?.method === "auto" ? "Auto" : "Manual";
  const checkinRange = activeCheckin ? countText(activeCheckin.playerCount) : "";
  const checkinAgo = activeCheckin ? minAgo(activeCheckin.scheduledArrivalAt.toMillis()) : "";

  return (
    <IonPage>
      <IonContent>
        <div className="my-activity">
          <h1 className="my-activity__title">My Activity</h1>

          {activeCheckin && (
            <div className="my-activity__active-card">
              <div className="my-activity__active-header">
                <span className="my-activity__active-court">
                  Checked in · {checkinCourtName}
                </span>
                <span className="my-activity__active-method">{checkinMethod}</span>
              </div>
              <p className="my-activity__active-report">
                {checkinRange !== "1" ? `${checkinRange} players` : "Just me"} · {checkinAgo}
              </p>
              <p className="my-activity__active-expires">
                Ends {expiresTime} unless you check out
              </p>
              <div className="my-activity__active-actions">
                <button
                  type="button"
                  className="my-activity__active-btn my-activity__active-btn--primary"
                  onClick={() => setShowUpdateSheet(true)}
                >
                  Update count
                </button>
                <button
                  type="button"
                  className="my-activity__active-btn my-activity__active-btn--outline"
                  onClick={handleCheckOut}
                >
                  Check out
                </button>
              </div>
            </div>
          )}

          {isEmpty ? (
            <div className="my-activity__empty">
              <div className="my-activity__empty-icon" aria-hidden="true">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M27.5999 10.2005C36.5999 3.30051 50.0999 4.20051 58.1999 12.3005C66.2999 20.4005 67.1999 33.9005 60.2999 42.9005L55.4999 47.7005C51.8999 51.3005 46.1999 51.9005 41.9999 48.9005L38.6999 46.5005L35.9999 49.2005L37.1999 50.4005C38.3999 51.6005 38.3999 53.4005 37.1999 54.6005L20.9999 70.8005C19.7999 72.0005 17.9999 72.0005 16.7999 70.8005L10.1999 64.2005C8.99993 63.0005 8.99993 61.2005 10.1999 60.0005L26.3999 43.8005C27.5999 42.6005 29.3999 42.6005 30.5999 43.8005L31.7999 45.0005L34.4999 42.3005L32.0999 39.0005C29.0999 34.8005 29.6999 29.1005 33.2999 25.5005L27.5999 10.2005Z"
                    fill="#0D9677"
                  />
                  <path
                    d="M37.5 25.5C39.1569 25.5 40.5 24.1569 40.5 22.5C40.5 20.8431 39.1569 19.5 37.5 19.5C35.8431 19.5 34.5 20.8431 34.5 22.5C34.5 24.1569 35.8431 25.5 37.5 25.5Z"
                    fill="white"
                  />
                  <path
                    d="M47.4001 27.6006C49.057 27.6006 50.4001 26.2574 50.4001 24.6006C50.4001 22.9437 49.057 21.6006 47.4001 21.6006C45.7433 21.6006 44.4001 22.9437 44.4001 24.6006C44.4001 26.2574 45.7433 27.6006 47.4001 27.6006Z"
                    fill="white"
                  />
                  <path
                    d="M39.5999 35.3994C41.2567 35.3994 42.5999 34.0563 42.5999 32.3994C42.5999 30.7426 41.2567 29.3994 39.5999 29.3994C37.943 29.3994 36.5999 30.7426 36.5999 32.3994C36.5999 34.0563 37.943 35.3994 39.5999 35.3994Z"
                    fill="white"
                  />
                  <path
                    d="M49.5 37.5C51.1569 37.5 52.5 36.1569 52.5 34.5C52.5 32.8431 51.1569 31.5 49.5 31.5C47.8431 31.5 46.5 32.8431 46.5 34.5C46.5 36.1569 47.8431 37.5 49.5 37.5Z"
                    fill="white"
                  />
                  <path
                    d="M12.0001 21.5994C15.6452 21.5994 18.6001 18.6445 18.6001 14.9994C18.6001 11.3543 15.6452 8.39941 12.0001 8.39941C8.35507 8.39941 5.40015 11.3543 5.40015 14.9994C5.40015 18.6445 8.35507 21.5994 12.0001 21.5994Z"
                    stroke="#0D9677"
                    strokeWidth="4.8"
                  />
                </svg>
              </div>
              <p className="my-activity__empty-heading">Nothing here yet</p>
              <p className="my-activity__empty-sub">
                Check in at a court or join a game and it will show up here.
              </p>
              <button
                type="button"
                className="my-activity__find-btn"
                onClick={() => ionRouter.push("/courts", "root")}
              >
                Find a court
              </button>
            </div>
          ) : (
            <>
              <div className="my-activity__seg">
                <button
                  type="button"
                  className={`my-activity__seg-btn${segment === "games" ? " my-activity__seg-btn--active" : ""}`}
                  onClick={() => setSegment("games")}
                >
                  Games
                </button>
                <button
                  type="button"
                  className={`my-activity__seg-btn${segment === "checkins" ? " my-activity__seg-btn--active" : ""}`}
                  onClick={() => setSegment("checkins")}
                >
                  Check-ins
                </button>
              </div>

              {segment === "games" && (
                <div className="my-activity__list">
                  {upcoming.length > 0 && (
                    <>
                      <p className="my-activity__section-label">Upcoming</p>
                      {upcoming.map((g) => (
                        <GameRow
                          key={g.id}
                          game={g}
                          uid={uid ?? ""}
                          onTap={() => ionRouter.push(`/courts/${g.courtId}`, "forward")}
                        />
                      ))}
                    </>
                  )}
                  {previousGames.length > 0 && (
                    <>
                      <p className="my-activity__section-label">Previous</p>
                      {previousGames.map((g) => (
                        <GameRow
                          key={g.id}
                          game={g}
                          uid={uid ?? ""}
                          onTap={() => ionRouter.push(`/courts/${g.courtId}`, "forward")}
                        />
                      ))}
                    </>
                  )}
                  {upcoming.length === 0 && previousGames.length === 0 && (
                    <p className="my-activity__empty-sub" style={{ marginTop: 24 }}>
                      No games yet.
                    </p>
                  )}
                </div>
              )}

              {segment === "checkins" && (
                <div className="my-activity__list">
                  {checkins.length > 0 && (
                    <>
                      <p className="my-activity__section-label">Previous</p>
                      {checkins.map((c) => {
                        const range = countText(c.playerCount);
                        const dur = formatDuration(
                          c.checkedInAt.toMillis(),
                          c.checkedOutAt ? c.checkedOutAt.toMillis() : null,
                          c.expiresAt.toMillis(),
                        );
                        const isAuto = c.method === "auto";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="my-activity__row"
                            onClick={() => ionRouter.push(`/courts/${c.courtId}`, "forward")}
                          >
                            <div className="my-activity__row-body">
                              <p className="my-activity__row-title">{c.courtName}</p>
                              <p className="my-activity__row-sub">
                                {formatCheckinDate(c.checkedInAt.toMillis())} · {dur} · reported{" "}
                                {range === "1" ? "1" : range}
                              </p>
                            </div>
                            <span
                              className={`my-activity__pill ${isAuto ? "my-activity__pill--auto" : "my-activity__pill--manual"}`}
                            >
                              {isAuto ? "Auto" : "Manual"}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {checkins.length === 0 && (
                    <p className="my-activity__empty-sub" style={{ marginTop: 24 }}>
                      No check-ins yet.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>

      <IonModal
        isOpen={showUpdateSheet}
        onDidDismiss={() => setShowUpdateSheet(false)}
        initialBreakpoint={0.6}
        breakpoints={[0, 0.6]}
        className="my-activity__update-modal"
      >
        <div className="my-activity__update-sheet">
          <p className="my-activity__update-heading">How many players now?</p>
          <div className="my-activity__update-list">
            {CROWD_RANGES.map((r) => (
              <button
                key={r.min}
                type="button"
                className={`my-activity__update-row${selectedCount === r.min ? " my-activity__update-row--selected" : ""}`}
                onClick={() => setSelectedCount(r.min)}
              >
                <span className="my-activity__update-label">{r.label}</span>
                <span className="my-activity__update-count">
                  {r.min === 1 ? "1" : r.countText}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="my-activity__update-save"
            disabled={isSaving}
            onClick={() => void handleUpdateCount()}
          >
            Update
          </button>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default MyActivityPage;
