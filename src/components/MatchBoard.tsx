import { useEffect, useMemo, useState } from "react";
import {
  IonAlert,
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
  type AlertInput,
} from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { useMyGames } from "../hooks/useMyGames";
import { MatchService, SPOTS_BY_FORMAT } from "../services/MatchService";
import type {
  Court,
  Match,
  MatchFormat,
  SkillLevel,
  Sport,
} from "../types/types";
import { courtSports } from "../utils/courts";
import {
  describeGame,
  findConflict,
  type PlayerGame,
} from "../utils/gameOverlap";
import { formatSkill, SKILL_LEVELS, SPORT_LABEL } from "../utils/skill";
import { buildStart, formatStart } from "../utils/time";
import "./MatchBoard.css";

const NAME_KEY = "peachcourt-first-name";

const JOIN_INPUTS: AlertInput[] = [
  {
    name: "playerName",
    type: "text",
    placeholder: "Your first name",
    attributes: { maxlength: 40 },
  },
];

const FORMAT_LABEL: Record<MatchFormat, string> = {
  singles: "Singles",
  doubles: "Doubles",
};

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

interface MatchBoardProps {
  court: Court;
  isPostOpen: boolean;
  onClosePost: () => void;
}

const MatchBoard: React.FC<MatchBoardProps> = ({
  court,
  isPostOpen,
  onClosePost,
}) => {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { tennisCourts, pickleballCourts, pickleballLines } = court;
  const sports = useMemo(
    () => courtSports({ tennisCourts, pickleballCourts, pickleballLines }),
    [tennisCourts, pickleballCourts, pickleballLines],
  );
  const [matches, setMatches] = useState<Match[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("");
  const [sport, setSport] = useState<Sport>(sports[0] ?? "tennis");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("any");
  const [joiningMatch, setJoiningMatch] = useState<Match | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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
      setName(readSavedName() || user?.displayName?.split(" ")[0] || "");
      setSport(sports[0] ?? "tennis");
      setFormat("doubles");
      setDay("today");
      setTime("");
      setSkillLevel("any");
    }
  }, [isPostOpen, user, sports]);

  const postStartAt = buildStart(day, time);
  const postConflict: PlayerGame | null = uid
    ? findConflict(postStartAt?.getTime() ?? NaN, myGames, now)
    : null;

  const handlePost = async () => {
    const trimmedName = name.trim();
    const startAt = buildStart(day, time);
    if (!trimmedName) {
      setToastMessage("Enter your first name.");
      return;
    }
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
        trimmedName,
        format,
        startAt,
        skillLevel,
      );
      saveName(trimmedName);
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

  const handleJoin = async (match: Match, playerName: string) => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setToastMessage("Enter your first name to join.");
      return;
    }

    setIsBusy(true);
    try {
      await MatchService.joinMatch(match.id, trimmedName);
      saveName(trimmedName);
      setToastMessage(`You joined ${match.hostName}'s game.`);
    } catch (error) {
      console.error("Unable to join the game", error);
      setToastMessage(
        `Joining failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleLeave = async (match: Match) => {
    setIsBusy(true);
    try {
      await MatchService.leaveMatch(match.id);
      setToastMessage(`You left ${match.hostName}'s game.`);
    } catch (error) {
      console.error("Unable to leave the game", error);
      setToastMessage(
        `Leaving failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="match-board" aria-labelledby="match-board-heading">
      <h2 id="match-board-heading" className="match-board__heading">
        Open games
      </h2>

      {upcomingMatches.length === 0 && (
        <p className="match-board__empty">
          No open games yet. Post one to find a partner.
        </p>
      )}

      {upcomingMatches.map((match) => {
        const spotsLeft = Math.max(
          0,
          match.spotsTotal - match.playerUids.length,
        );
        const isHost = match.hostUid === uid;
        const hasJoined = uid !== null && match.playerUids.includes(uid);
        const isFull = spotsLeft === 0;
        const joinConflict: PlayerGame | null =
          !isHost && !hasJoined && uid
            ? findConflict(match.startAt.toMillis(), myGames, now, match.id)
            : null;

        return (
          <article key={match.id} className="match-card">
            <div className="match-card__header">
              <span className="match-card__title">
                {match.hostName} · {FORMAT_LABEL[match.format]}
              </span>
              <span
                className={`match-card__spots${isFull ? " match-card__spots--full" : ""}`}
              >
                {isFull
                  ? "Full"
                  : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
              </span>
            </div>
            <p className="match-card__detail">
              {formatStart(match.startAt.toDate(), now)} ·{" "}
              {SPORT_LABEL[match.sport]} ·{" "}
              {formatSkill(match.sport, match.skillLevel)}
            </p>
            {(isHost || hasJoined) && (
              <p className="match-card__players">
                {match.playerNames.length > 0
                  ? `Joined: ${match.playerNames.join(", ")}`
                  : "No one has joined yet."}
              </p>
            )}
            {joinConflict && (
              <p className="match-conflict">
                You're already in a game at this time.{" "}
                {describeGame(joinConflict, joinConflict.courtName, now)} Leave
                that game or pick another one.
              </p>
            )}
            <div className="match-card__footer">
              {isHost ? (
                <span className="match-card__status">Your game</span>
              ) : hasJoined ? (
                <>
                  <span className="match-card__status">You're in</span>
                  <IonButton
                    size="small"
                    shape="round"
                    fill="outline"
                    disabled={isBusy}
                    onClick={() => void handleLeave(match)}
                  >
                    Leave
                  </IonButton>
                </>
              ) : (
                <IonButton
                  size="small"
                  shape="round"
                  disabled={isFull || isBusy || !uid || joinConflict !== null}
                  onClick={() => setJoiningMatch(match)}
                >
                  {isFull ? "Full" : "Join"}
                </IonButton>
              )}
            </div>
          </article>
        );
      })}

      <IonModal isOpen={isPostOpen} onDidDismiss={onClosePost}>
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
                  value={name}
                  maxlength={40}
                  autocapitalize="words"
                  onIonInput={(event) =>
                    setName(String(event.detail.value ?? ""))
                  }
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
              {SPOTS_BY_FORMAT[format]} open spot
              {SPOTS_BY_FORMAT[format] === 1 ? "" : "s"}. Anyone viewing this
              court can join.
            </p>
            {postConflict && (
              <p className="match-conflict">
                You're already in a game at this time.{" "}
                {describeGame(postConflict, postConflict.courtName, now)} Pick a
                time at least 1 hour apart.
              </p>
            )}
            <IonButton
              expand="block"
              disabled={isBusy || postConflict !== null}
              onClick={() => void handlePost()}
            >
              {isBusy ? "Posting…" : "Post game"}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={joiningMatch !== null}
        header="Join this game"
        message={
          joiningMatch
            ? `${joiningMatch.hostName} · ${FORMAT_LABEL[joiningMatch.format]} · ${formatStart(joiningMatch.startAt.toDate(), now)}`
            : ""
        }
        inputs={JOIN_INPUTS}
        buttons={[
          { text: "Cancel", role: "cancel" },
          {
            text: "Join",
            handler: (values: { playerName?: string }) => {
              if (joiningMatch) {
                void handleJoin(joiningMatch, values.playerName ?? "");
              }
            },
          },
        ]}
        onDidDismiss={() => setJoiningMatch(null)}
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
