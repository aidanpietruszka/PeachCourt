import { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonRouter,
} from "@ionic/react";
import GameDetailModal from "./GameDetailModal";
import { useAuth } from "../hooks/useAuth";
import { useMyGames } from "../hooks/useMyGames";
import { MatchService, SPOTS_BY_FORMAT } from "../services/MatchService";
import { UserService } from "../services/UserService";
import type {
  Court,
  Match,
  MatchFormat,
  SkillLevel,
  Sport,
  UserProfile,
} from "../types/types";
import { courtSports } from "../utils/courts";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filterMatches,
  type GameFilterFormat,
  type GameFilterSkill,
  type GameFilterSport,
  type GameFilterWhen,
  type GameFilters,
} from "../utils/gameFilters";
import {
  describeGame,
  findConflict,
  type PlayerGame,
} from "../utils/gameOverlap";
import { formatSkill, SKILL_LEVELS, SPORT_LABEL } from "../utils/skill";
import { buildStart, formatInMinutes, formatStart } from "../utils/time";
import "./MatchBoard.css";

const NAME_KEY = "peachcourt-first-name";

const FORMAT_LABEL: Record<MatchFormat, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

const AVATAR_COLORS = [
  "#0d9677",
  "#2b5fd9",
  "#b7791f",
  "#8e44ad",
  "#e53e3e",
];

function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function readSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch (error) {
    console.warn("Unable to remember your first name", error);
  }
}

function skillRangeLabel(level: number): string {
  const lo = (level - 0.5).toFixed(1);
  const hi = (level + 0.5).toFixed(1);
  return `${lo}–${hi}`;
}

interface MatchBoardProps {
  court: Court;
  isPostOpen: boolean;
  onClosePost: () => void;
  joinSource?: string;
}

const MatchBoard: React.FC<MatchBoardProps> = ({
  court,
  isPostOpen,
  onClosePost,
  joinSource = "browsing",
}) => {
  const ionRouter = useIonRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { tennisCourts, pickleballCourts, pickleballLines } = court;
  const sports = useMemo(
    () => courtSports({ tennisCourts, pickleballCourts, pickleballLines }),
    [tennisCourts, pickleballCourts, pickleballLines],
  );
  const [matches, setMatches] = useState<Match[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("");
  const [sport, setSport] = useState<Sport>(sports[0] ?? "tennis");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("any");
  const [joinSheetMatch, setJoinSheetMatch] = useState<Match | null>(null);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [filters, setFilters] = useState<GameFilters>(DEFAULT_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const myGames = useMyGames(uid);

  useEffect(() => {
    return MatchService.subscribeToCourtMatches(
      court.id,
      setMatches,
      (error) => {
        console.error("Unable to load open games", error);
        setToastMessage("Open games are unavailable right now.");
      },
    );
  }, [court.id]);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    return UserService.subscribeToProfile(uid, setProfile, (error) => {
      console.error("Unable to load profile", error);
    });
  }, [uid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((match) => match.startAt.toMillis() > now)
        .sort(
          (first, second) =>
            first.startAt.toMillis() - second.startAt.toMillis(),
        ),
    [matches, now],
  );

  useEffect(() => {
    if (isPostOpen) {
      setSport(sports[0] ?? "tennis");
      setFormat("doubles");
      setDay("today");
      setTime("");
      setSkillLevel("any");
      setIsConfirmOpen(false);
    }
  }, [isPostOpen, sports]);

  const postStartAt = buildStart(day, time);
  const postConflict: PlayerGame | null = uid
    ? findConflict(postStartAt?.getTime() ?? NaN, myGames, now)
    : null;

  const userLevelForSport = (s: Sport): number | undefined =>
    profile?.skillLevels[s];

  const filteredMatches = useMemo(() => {
    const userLevel =
      filters.sport !== "both"
        ? profile?.skillLevels?.[filters.sport as Sport]
        : undefined;
    return filterMatches(upcomingMatches, filters, now, userLevel);
  }, [upcomingMatches, filters, now, profile]);

  const filterCount = activeFilterCount(filters);

  const handlePost = async () => {
    const postName = (profile?.firstName || readSavedName() || user?.displayName?.split(" ")[0] || "").trim();
    if (!postName) {
      setToastMessage("Set your first name in your profile to post a game.");
      return;
    }
    const startAt = buildStart(day, time);
    if (!startAt) {
      setToastMessage("Choose a start time.");
      return;
    }
    if (startAt.getTime() <= Date.now()) {
      setToastMessage("Choose a start time later than now.");
      return;
    }

    setIsBusy(true);
    try {
      await MatchService.postMatch(
        court.id,
        court.name,
        sport,
        postName,
        format,
        startAt,
        skillLevel,
      );
      saveName(postName);
      setIsConfirmOpen(false);
      onClosePost();
      setToastMessage("Your game is posted.");
    } catch (error) {
      console.error("Unable to post a game", error);
      setToastMessage(
        `Posting failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoin = async (match: Match) => {
    const joinName = (profile?.firstName || readSavedName() || user?.displayName?.split(" ")[0] || "").trim();
    if (!joinName) {
      setToastMessage("Set your first name in your profile to join games.");
      return;
    }

    setIsBusy(true);
    try {
      await MatchService.joinMatch(match.id, joinName, joinSource);
      saveName(joinName);
      setJoinSheetMatch(null);
      const time = match.startAt
        .toDate()
        .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setToastMessage(`You joined ${FORMAT_LABEL[match.format]} at ${time}`);
    } catch (error) {
      console.error("Unable to join the game", error);
      setToastMessage(
        `Joining failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const removeFilter = (key: keyof GameFilters) => {
    setFilters((prev) => ({
      ...prev,
      [key]: DEFAULT_FILTERS[key],
    }));
  };

  const activeChips: { label: string; key: keyof GameFilters }[] = [];
  if (filters.sport !== "both") {
    activeChips.push({ label: SPORT_LABEL[filters.sport as Sport], key: "sport" });
  }
  if (filters.format !== "any") {
    activeChips.push({ label: FORMAT_LABEL[filters.format as MatchFormat], key: "format" });
  }
  if (filters.skill !== "any") {
    activeChips.push({ label: "Near my level", key: "skill" });
  }
  if (filters.when !== "any") {
    const WHEN_LABEL: Record<string, string> = {
      next_hour: "Next hour",
      today: "Today",
      tomorrow: "Tomorrow",
    };
    activeChips.push({ label: WHEN_LABEL[filters.when] ?? filters.when, key: "when" });
  }
  if (filters.hideFull) {
    activeChips.push({ label: "Hide full", key: "hideFull" });
  }

  const headingCount =
    filterCount > 0
      ? `Open games (${filteredMatches.length} of ${upcomingMatches.length})`
      : `Open games (${upcomingMatches.length})`;

  const joinSheetConflict =
    joinSheetMatch && uid
      ? findConflict(joinSheetMatch.startAt.toMillis(), myGames, now, joinSheetMatch.id)
      : null;

  const detailMatchLive = detailMatch
    ? (matches.find((m) => m.id === detailMatch.id) ?? null)
    : null;

  useEffect(() => {
    if (detailMatch && !detailMatchLive) {
      setDetailMatch(null);
      setToastMessage("This game has been cancelled.");
    }
  }, [detailMatch, detailMatchLive]);

  const filterSportForNear = filters.sport !== "both" ? (filters.sport as Sport) : undefined;
  const nearUserLevel = filterSportForNear ? userLevelForSport(filterSportForNear) : undefined;

  return (
    <section className="match-board" aria-labelledby="match-board-heading">
      <div className="match-board__filter-row">
        <h2 id="match-board-heading" className="match-board__heading">
          {headingCount}
        </h2>
        <button
          type="button"
          className={`match-board__filter-btn${filterCount > 0 ? " match-board__filter-btn--active" : ""}`}
          onClick={() => setIsFilterOpen(true)}
          aria-label="Filter games"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="4" cy="4" r="1.5" fill="currentColor" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          </svg>
          {filterCount > 0 ? `Filter games · ${filterCount}` : "Filter games"}
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="match-board__chips">
          {activeChips.map(({ label, key }) => (
            <button
              key={key}
              type="button"
              className="match-board__chip"
              onClick={() => removeFilter(key)}
              aria-label={`Remove ${label} filter`}
            >
              {label} ✕
            </button>
          ))}
        </div>
      )}

      {filteredMatches.length === 0 && upcomingMatches.length === 0 && (
        <p className="match-board__empty">
          No open games yet. Post one to find a partner.
        </p>
      )}

      {filteredMatches.length === 0 && upcomingMatches.length > 0 && (
        <p className="match-board__empty">
          No games match your filters.
        </p>
      )}

      {filteredMatches.map((match) => {
        const startMs = match.startAt.toMillis();
        const spotsLeft = Math.max(0, match.spotsTotal - match.playerUids.length);
        const isHost = match.hostUid === uid;
        const hasJoined = uid !== null && match.playerUids.includes(uid);
        const isFull = spotsLeft === 0;
        const isSoon = formatInMinutes(startMs, now) !== null;
        const joinConflict: PlayerGame | null =
          !isHost && !hasJoined && uid
            ? findConflict(startMs, myGames, now, match.id)
            : null;
        const allPlayers = [match.hostName, ...match.playerNames];
        const totalSpots = 1 + match.spotsTotal;
        const openSpotsCount = totalSpots - allPlayers.length;
        const userLevel = userLevelForSport(match.sport);
        const levelMatches =
          typeof match.skillLevel === "number" &&
          typeof userLevel === "number" &&
          Math.abs(match.skillLevel - userLevel) <= 0.5;
        const levelMismatch =
          typeof match.skillLevel === "number" &&
          typeof userLevel === "number" &&
          Math.abs(match.skillLevel - userLevel) > 0.5;

        return (
          <article
            key={match.id}
            className={`match-card${isFull && !hasJoined && !isHost ? " match-card--full" : ""}${hasJoined ? " match-card--joined" : ""}${isHost || hasJoined ? " match-card--tappable" : ""}`}
            onClick={() => {
              if (isHost || hasJoined) setDetailMatch(match);
            }}
          >
            <div className="match-card__header">
              <span className="match-card__title">
                {FORMAT_LABEL[match.format]} · {SPORT_LABEL[match.sport]}
              </span>
              {hasJoined ? (
                <span className="match-card__in-badge">You&apos;re in</span>
              ) : isHost ? (
                <span className="match-card__status">Your game</span>
              ) : isFull ? (
                <span className="match-card__full-badge">Full</span>
              ) : (
                <IonButton
                  size="small"
                  shape="round"
                  disabled={isBusy || !uid || joinConflict !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    setJoinSheetMatch(match);
                  }}
                >
                  Join
                </IonButton>
              )}
            </div>

            <p className={`match-card__time${isSoon ? " match-card__time--soon" : ""}`}>
              {formatStart(match.startAt.toDate(), now)}
              {isSoon ? ` · ${formatInMinutes(startMs, now)!}` : ""}
            </p>

            {typeof match.skillLevel === "number" && (
              <div className="match-card__skill-row">
                <span className={`match-skill${levelMismatch ? " match-skill--mismatch" : ""}`}>
                  Skill {formatSkill(match.sport, match.skillLevel)}
                </span>
                {levelMatches && (
                  <span className="match-skill__label">Matches your level</span>
                )}
                {levelMismatch && (
                  <span className="match-skill__label match-skill__label--mismatch">
                    Your level: {formatSkill(match.sport, userLevel!)}
                  </span>
                )}
              </div>
            )}

            <div className="match-card__players-row">
              <div className="match-avatars">
                {allPlayers.map((pname, i) => (
                  <div
                    key={i}
                    className="match-avatar"
                    style={{ background: avatarColor(i) }}
                  >
                    {pname.charAt(0).toUpperCase()}
                  </div>
                ))}
                {Array.from({ length: openSpotsCount }).map((_, i) => (
                  <div key={`open-${i}`} className="match-avatar match-avatar--open" />
                ))}
              </div>
              <span className="match-card__player-count">
                {allPlayers.length} of {totalSpots} · Host {match.hostName}
              </span>
            </div>

            {isHost && match.playerNames.length > 0 && (
              <p className="match-card__players">
                Joined: {match.playerNames.join(", ")}
              </p>
            )}

            {joinConflict && (
              <p className="match-conflict">
                You&apos;re already in a game at this time.{" "}
                {describeGame(joinConflict, joinConflict.courtName, now)} Leave
                that game or pick another one.
              </p>
            )}

          </article>
        );
      })}

      <IonModal
        isOpen={joinSheetMatch !== null}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        onDidDismiss={() => setJoinSheetMatch(null)}
        aria-label="Join game"
      >
        <IonContent>
          {joinSheetMatch && (
            <div className="join-sheet">
              <h2 className="join-sheet__title">
                {FORMAT_LABEL[joinSheetMatch.format]} · {SPORT_LABEL[joinSheetMatch.sport]}
              </h2>
              <p className="join-sheet__subtitle">
                {court.name} · {formatStart(joinSheetMatch.startAt.toDate(), now)}
                {formatInMinutes(joinSheetMatch.startAt.toMillis(), now)
                  ? ` (${formatInMinutes(joinSheetMatch.startAt.toMillis(), now)!})`
                  : ""}
              </p>
              <div className="join-sheet__tags">
                {typeof joinSheetMatch.skillLevel === "number" && (
                  <span className="join-sheet__tag">
                    Skill {formatSkill(joinSheetMatch.sport, joinSheetMatch.skillLevel)}
                  </span>
                )}
                <span className="join-sheet__tag join-sheet__tag--neutral">
                  {joinSheetMatch.playerUids.length + 1} of {1 + joinSheetMatch.spotsTotal} spots filled
                </span>
                {(() => {
                  const ul = userLevelForSport(joinSheetMatch.sport);
                  return typeof joinSheetMatch.skillLevel === "number" &&
                    typeof ul === "number" &&
                    Math.abs(joinSheetMatch.skillLevel - ul) <= 0.5 ? (
                    <span className="join-sheet__tag">Matches your level</span>
                  ) : null;
                })()}
              </div>
              <div className="join-sheet__roster">
                {[joinSheetMatch.hostName, ...joinSheetMatch.playerNames].map((pname, i) => (
                  <div key={i} className="join-sheet__player-row">
                    <div
                      className="match-avatar"
                      style={{ background: avatarColor(i) }}
                    >
                      {pname.charAt(0).toUpperCase()}
                    </div>
                    <span className="join-sheet__player-name">{pname}</span>
                    <span className="join-sheet__player-role">
                      {i === 0 ? `Host · ${typeof joinSheetMatch.skillLevel === "number" ? formatSkill(joinSheetMatch.sport, joinSheetMatch.skillLevel) : "Any level"}` : ""}
                    </span>
                  </div>
                ))}
                {Array.from({
                  length: joinSheetMatch.spotsTotal - joinSheetMatch.playerUids.length,
                }).map((_, i) => (
                  <div key={`open-${i}`} className="join-sheet__player-row join-sheet__open-spot">
                    <div className="match-avatar match-avatar--open" />
                    <span className="join-sheet__player-name join-sheet__open-label">
                      Open spot
                    </span>
                  </div>
                ))}
              </div>
              {joinSheetConflict && (
                <div className="join-sheet__conflict">
                  <p className="join-sheet__conflict-title">
                    You&apos;re already in a game at this time
                  </p>
                  <p className="join-sheet__conflict-body">
                    {describeGame(joinSheetConflict, joinSheetConflict.courtName, now)}{" "}
                    Leave that game or pick another one.
                  </p>
                </div>
              )}
              <IonButton
                expand="block"
                disabled={isBusy || joinSheetConflict !== null}
                onClick={() => void handleJoin(joinSheetMatch)}
              >
                Join game
              </IonButton>
              <IonButton
                expand="block"
                fill="clear"
                disabled={isBusy}
                onClick={() => setJoinSheetMatch(null)}
              >
                Cancel
              </IonButton>
            </div>
          )}
        </IonContent>
      </IonModal>

      <IonModal
        isOpen={isFilterOpen}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        onDidDismiss={() => setIsFilterOpen(false)}
        aria-label="Filter games"
      >
        <IonContent>
          <div className="game-filter-sheet">
            <div className="game-filter-sheet__header">
              <div>
                <h2 className="game-filter-sheet__title">Filter games</h2>
                <p className="game-filter-sheet__subtitle">at {court.name}</p>
              </div>
              <button
                type="button"
                className="game-filter-sheet__reset"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Reset
              </button>
            </div>

            <h3 className="game-filter-sheet__heading">Sport</h3>
            <div className="game-filter-sheet__segment">
              {(["both", "pickleball", "tennis"] as GameFilterSport[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`game-filter-sheet__seg-btn${filters.sport === opt ? " game-filter-sheet__seg-btn--active" : ""}`}
                  onClick={() => setFilters((f) => ({ ...f, sport: opt }))}
                >
                  {opt === "both" ? "Both" : SPORT_LABEL[opt]}
                </button>
              ))}
            </div>

            <h3 className="game-filter-sheet__heading">Format</h3>
            <div className="game-filter-sheet__segment">
              {(["any", "singles", "doubles"] as GameFilterFormat[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`game-filter-sheet__seg-btn${filters.format === opt ? " game-filter-sheet__seg-btn--active" : ""}`}
                  onClick={() => setFilters((f) => ({ ...f, format: opt }))}
                >
                  {opt === "any" ? "Any" : FORMAT_LABEL[opt as MatchFormat]}
                </button>
              ))}
            </div>

            <h3 className="game-filter-sheet__heading">Skill</h3>
            <div className="game-filter-sheet__chips">
              {(["near", "any"] as GameFilterSkill[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`filter-chip${filters.skill === opt ? " filter-chip--selected" : ""}`}
                  onClick={() => setFilters((f) => ({ ...f, skill: opt }))}
                >
                  {opt === "near"
                    ? `Near my level${nearUserLevel !== undefined ? ` (${skillRangeLabel(nearUserLevel)})` : ""}`
                    : "Any"}
                </button>
              ))}
            </div>

            <h3 className="game-filter-sheet__heading">When</h3>
            <div className="game-filter-sheet__chips">
              {(["next_hour", "today", "tomorrow", "any"] as GameFilterWhen[]).map((opt) => {
                const LABEL: Record<string, string> = {
                  next_hour: "Next hour",
                  today: "Today",
                  tomorrow: "Tomorrow",
                  any: "Any time",
                };
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`filter-chip${filters.when === opt ? " filter-chip--selected" : ""}`}
                    onClick={() => setFilters((f) => ({ ...f, when: opt }))}
                  >
                    {LABEL[opt]}
                  </button>
                );
              })}
            </div>

            <div className="game-filter-sheet__toggle-row">
              <span className="game-filter-sheet__toggle-label">Hide full games</span>
              <button
                type="button"
                role="switch"
                aria-checked={filters.hideFull}
                className={`game-filter-sheet__toggle${filters.hideFull ? " game-filter-sheet__toggle--on" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, hideFull: !f.hideFull }))}
              >
                <span className="game-filter-sheet__toggle-thumb" />
              </button>
            </div>

            <button
              type="button"
              className="game-filter-sheet__show-btn"
              onClick={() => setIsFilterOpen(false)}
            >
              Show {filteredMatches.length} game{filteredMatches.length === 1 ? "" : "s"}
            </button>
          </div>
        </IonContent>
      </IonModal>

      <IonModal
        isOpen={isPostOpen}
        onDidDismiss={() => {
          setIsConfirmOpen(false);
          onClosePost();
        }}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onClosePost}>Cancel</IonButton>
            </IonButtons>
            <IonTitle>Post a game</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="pc-screen">
            <p className="pc-subtitle">{court.name}</p>
            {sports.length > 1 && (
              <IonSegment
                value={sport}
                onIonChange={(event) => {
                  setSport(event.detail.value as Sport);
                  setSkillLevel("any");
                }}
              >
                {sports.map((option) => (
                  <IonSegmentButton key={option} value={option}>
                    <IonLabel>{SPORT_LABEL[option]}</IonLabel>
                  </IonSegmentButton>
                ))}
              </IonSegment>
            )}
            <IonSegment
              value={format}
              onIonChange={(event) =>
                setFormat(event.detail.value as MatchFormat)
              }
            >
              <IonSegmentButton value="doubles">
                <IonLabel>Doubles</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="singles">
                <IonLabel>Singles</IonLabel>
              </IonSegmentButton>
            </IonSegment>
            <IonList inset>
              <IonItem>
                <IonInput
                  label="First name"
                  labelPlacement="stacked"
                  value={profile?.firstName || readSavedName() || user?.displayName?.split(" ")[0] || ""}
                  maxlength={40}
                  autocapitalize="words"
                  readonly
                />
              </IonItem>
              <IonItem>
                <IonSelect
                  label="Day"
                  value={day}
                  interface="popover"
                  onIonChange={(event) =>
                    setDay(event.detail.value as "today" | "tomorrow")
                  }
                >
                  <IonSelectOption value="today">Today</IonSelectOption>
                  <IonSelectOption value="tomorrow">Tomorrow</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonInput
                  label="Start time"
                  labelPlacement="stacked"
                  type="time"
                  value={time}
                  onIonInput={(event) =>
                    setTime(String(event.detail.value ?? ""))
                  }
                />
              </IonItem>
              <IonItem>
                <IonSelect
                  label={
                    sport === "tennis" ? "Skill level (NTRP)" : "Skill level"
                  }
                  value={String(skillLevel)}
                  interface="popover"
                  onIonChange={(event) => {
                    const value = String(event.detail.value);
                    setSkillLevel(value === "any" ? "any" : Number(value));
                  }}
                >
                  <IonSelectOption value="any">Any level</IonSelectOption>
                  {SKILL_LEVELS[sport].map((level) => (
                    <IonSelectOption key={level} value={String(level)}>
                      {formatSkill(sport, level)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonList>
            <p className="match-board__note">
              Players near your skill level get an alert.
            </p>
            <IonButton
              expand="block"
              onClick={() => {
                const startAt = buildStart(day, time);
                if (!startAt) {
                  setToastMessage("Choose a start time.");
                  return;
                }
                if (startAt.getTime() <= Date.now()) {
                  setToastMessage("Choose a start time later than now.");
                  return;
                }
                setIsConfirmOpen(true);
              }}
            >
              Post game
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonModal
        isOpen={isConfirmOpen}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        onDidDismiss={() => setIsConfirmOpen(false)}
        aria-label="Confirm game"
      >
        <IonContent>
          <div className="confirm-sheet">
            <h2 className="confirm-sheet__title">Check your game</h2>
            <div className="confirm-sheet__rows">
              <div className="confirm-sheet__row">
                <span className="confirm-sheet__label">Court</span>
                <span className="confirm-sheet__value">{court.name}</span>
              </div>
              <div className="confirm-sheet__row">
                <span className="confirm-sheet__label">Sport</span>
                <span className="confirm-sheet__value">{SPORT_LABEL[sport]}</span>
              </div>
              <div className="confirm-sheet__row">
                <span className="confirm-sheet__label">Format</span>
                <span className="confirm-sheet__value">
                  {FORMAT_LABEL[format]} ({1 + SPOTS_BY_FORMAT[format]} players)
                </span>
              </div>
              <div className="confirm-sheet__row">
                <span className="confirm-sheet__label">When</span>
                <span className="confirm-sheet__value">
                  {postStartAt
                    ? `${day === "today" ? "Today" : "Tomorrow"}, ${postStartAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                    : "—"}
                </span>
              </div>
              <div className="confirm-sheet__row">
                <span className="confirm-sheet__label">Skill level</span>
                <span className="confirm-sheet__value">
                  {skillLevel === "any"
                    ? "Any level"
                    : `${formatSkill(sport, skillLevel as number)}${
                        profile?.skillLevels[sport] === skillLevel
                          ? " (from your profile)"
                          : ""
                      }`}
                </span>
              </div>
            </div>
            <div className="confirm-sheet__note">
              <p className="confirm-sheet__note-title">
                You can&apos;t edit a game after posting
              </p>
              <p className="confirm-sheet__note-body">
                To change it later you&apos;d have to delete it and post again.
              </p>
            </div>
            {postConflict && (
              <div className="confirm-sheet__conflict">
                <p className="confirm-sheet__conflict-title">
                  You&apos;re already in a game at this time
                </p>
                <p className="confirm-sheet__conflict-body">
                  {describeGame(postConflict, postConflict.courtName, now)} Pick
                  a time at least 1 hour apart.
                </p>
              </div>
            )}
            <IonButton
              expand="block"
              disabled={isBusy || postConflict !== null}
              onClick={() => void handlePost()}
            >
              {isBusy ? "Posting…" : "Post game"}
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              disabled={isBusy}
              onClick={() => setIsConfirmOpen(false)}
            >
              Go back
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <GameDetailModal
        match={detailMatchLive}
        courtName={court.name}
        onClose={() => setDetailMatch(null)}
        onOpenChat={(matchId) => {
          setDetailMatch(null);
          ionRouter.push(`/chats/${matchId}`, "forward");
        }}
      />

      <IonToast
        isOpen={toastMessage.length > 0}
        message={toastMessage}
        duration={3500}
        onDidDismiss={() => setToastMessage("")}
      />
    </section>
  );
};

export default MatchBoard;
