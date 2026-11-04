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
              <div className="my-activity__empty-icon" aria-hidden="true">🏓</div>
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
