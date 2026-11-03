import { useState } from "react";
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonModal,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useAuth } from "../hooks/useAuth";
import { MatchService } from "../services/MatchService";
import type { Match, MatchFormat } from "../types/types";
import { formatSkill, SPORT_LABEL } from "../utils/skill";
import { formatInMinutes, formatStart } from "../utils/time";
import "./GameDetailModal.css";

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

type ConfirmType =
  | "leave_player"
  | "leave_host_handoff"
  | "leave_host_alone"
  | "delete"
  | "remove_player"
  | null;

interface GameDetailModalProps {
  match: Match | null;
  courtName: string;
  onClose: () => void;
}

const GameDetailModal: React.FC<GameDetailModalProps> = ({
  match,
  courtName,
  onClose,
}) => {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [confirmType, setConfirmType] = useState<ConfirmType>(null);
  const [removeTarget, setRemoveTarget] = useState<{ uid: string; name: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isHost = !!match && match.hostUid === uid;
  const now = Date.now();

  const handleLeaveAsPlayer = async () => {
    if (!match) return;
    setIsBusy(true);
    try {
      await MatchService.leaveMatch(match.id);
      setToastMessage(`You left ${match.hostName}'s game.`);
      onClose();
    } catch (error) {
      setToastMessage(
        `Leaving failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleHostLeave = async () => {
    if (!match) return;
    setIsBusy(true);
    try {
      await MatchService.hostLeaveGame(match.id);
      setToastMessage(
        confirmType === "leave_host_alone" ? "Game cancelled." : "You left the game.",
      );
      onClose();
    } catch (error) {
      setToastMessage(
        `Leaving failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!match) return;
    setIsBusy(true);
    try {
      await MatchService.deleteGame(match.id);
      setToastMessage("Game deleted.");
      onClose();
    } catch (error) {
      setToastMessage(
        `Delete failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!match || !removeTarget) return;
    setIsBusy(true);
    try {
      await MatchService.removePlayer(match.id, removeTarget.uid);
      setToastMessage(`${removeTarget.name} was removed.`);
      setRemoveTarget(null);
    } catch (error) {
      setToastMessage(
        `Remove failed: ${error instanceof Error ? error.message : "Please try again."}`,
      );
    } finally {
      setIsBusy(false);
    }
  };

  const openLeaveConfirm = () => {
    if (!match) return;
    if (isHost) {
      setConfirmType(match.playerUids.length > 0 ? "leave_host_handoff" : "leave_host_alone");
    } else {
      setConfirmType("leave_player");
    }
  };

  const alertHeader = (): string => {
    switch (confirmType) {
      case "leave_player": return "Leave this game?";
      case "leave_host_handoff": return "Leave and hand off?";
      case "leave_host_alone": return "Leave and cancel?";
      case "delete": return "Delete this game?";
      case "remove_player": return `Remove ${removeTarget?.name ?? "player"}?`;
      default: return "";
    }
  };

  const alertMessage = (): string => {
    if (!match) return "";
    switch (confirmType) {
      case "leave_player":
        return "Your spot opens up for someone else.";
      case "leave_host_handoff":
        return `${match.playerNames[0]} will become the host.`;
      case "leave_host_alone":
        return "You're the only player. The game will be deleted.";
      case "delete":
        return match.playerUids.length > 0
          ? `All ${match.playerUids.length} player${match.playerUids.length === 1 ? "" : "s"} will be notified.`
          : "This will permanently remove the game.";
      case "remove_player":
        return `${removeTarget?.name ?? "This player"} will be notified and won't be able to rejoin.`;
      default:
        return "";
    }
  };

  const alertButtons = () => {
    switch (confirmType) {
      case "leave_player":
        return [
          { text: "Stay", role: "cancel" },
          { text: "Leave game", role: "destructive", handler: () => void handleLeaveAsPlayer() },
        ];
      case "leave_host_handoff":
        return [
          { text: "Stay", role: "cancel" },
          { text: "Leave and hand off", handler: () => void handleHostLeave() },
        ];
      case "leave_host_alone":
        return [
          { text: "Stay", role: "cancel" },
          { text: "Cancel game", role: "destructive", handler: () => void handleHostLeave() },
        ];
      case "delete":
        return [
          { text: "Keep game", role: "cancel" },
          { text: "Delete game", role: "destructive", handler: () => void handleDelete() },
        ];
      case "remove_player":
        return [
          { text: "Cancel", role: "cancel" },
          {
            text: `Remove ${removeTarget?.name ?? "player"}`,
            role: "destructive",
            handler: () => void handleRemove(),
          },
        ];
      default:
        return [];
    }
  };

  const allPlayers = match ? [match.hostName, ...match.playerNames] : [];
  const totalSpots = match ? 1 + match.spotsTotal : 0;
  const openSpotsCount = totalSpots - allPlayers.length;
  const startMs = match?.startAt.toMillis() ?? 0;
  const isSoon = match ? formatInMinutes(startMs, now) !== null : false;

  return (
    <>
      <IonModal
        isOpen={match !== null}
        onDidDismiss={onClose}
        aria-label="Game detail"
      >
        {match && (
          <>
            <IonHeader>
              <IonToolbar>
                <IonButtons slot="start">
                  <IonButton onClick={onClose} className="game-detail__back-btn">
                    ← {courtName}
                  </IonButton>
                </IonButtons>
                <IonTitle />
              </IonToolbar>
            </IonHeader>

            <IonContent>
              <div className="game-detail">
                <h2 className="game-detail__title">
                  {FORMAT_LABEL[match.format]} · {SPORT_LABEL[match.sport]}
                </h2>
                <p className="game-detail__subtitle">
                  {courtName} · {formatStart(match.startAt.toDate(), now)}
                  {isSoon ? ` (${formatInMinutes(startMs, now)!})` : ""}
                </p>

                <div className="game-detail__tags">
                  {typeof match.skillLevel === "number" && (
                    <span className="game-detail__tag">
                      Skill {formatSkill(match.sport, match.skillLevel)}
                    </span>
                  )}
                  <span className="game-detail__tag game-detail__tag--neutral">
                    {allPlayers.length} of {totalSpots} spots filled
                  </span>
                  {isHost ? (
                    <span className="game-detail__tag game-detail__tag--hosting">
                      You&apos;re hosting
                    </span>
                  ) : (
                    <span className="game-detail__tag">You&apos;re in</span>
                  )}
                </div>

                <p className="game-detail__section-heading">Players</p>
                <div className="game-detail__roster">
                  {allPlayers.map((pname, i) => {
                    const playerUid = i === 0 ? match.hostUid : match.playerUids[i - 1];
                    const isSelf = playerUid === uid;
                    return (
                      <div key={i} className="game-detail__roster-row">
                        <div
                          className="match-avatar"
                          style={{ background: avatarColor(i) }}
                        >
                          {pname.charAt(0).toUpperCase()}
                        </div>
                        <span className="game-detail__player-name">
                          {pname}{isSelf ? " (you)" : ""}
                        </span>
                        {i === 0 && (
                          <span className="game-detail__host-label">Host</span>
                        )}
                        {isHost && i > 0 && (
                          <button
                            type="button"
                            className="game-detail__remove-btn"
                            disabled={isBusy}
                            onClick={() => {
                              setRemoveTarget({ uid: playerUid, name: pname });
                              setConfirmType("remove_player");
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {Array.from({ length: openSpotsCount }).map((_, i) => (
                    <div key={`open-${i}`} className="game-detail__open-spot">
                      <div className="match-avatar match-avatar--open" />
                      <span className="game-detail__open-label">Open spot</span>
                    </div>
                  ))}
                </div>

                <div className="game-detail__actions">
                  <IonButton fill="outline" size="small" disabled>
                    Open chat
                  </IonButton>
                  <IonButton fill="outline" size="small" disabled>
                    Directions
                  </IonButton>
                </div>
              </div>
            </IonContent>

            <IonFooter className="game-detail__footer">
              {isHost ? (
                <>
                  <IonButton
                    fill="outline"
                    expand="block"
                    style={{ flex: 1 }}
                    disabled={isBusy}
                    onClick={openLeaveConfirm}
                  >
                    Leave game
                  </IonButton>
                  <IonButton
                    color="danger"
                    expand="block"
                    style={{ flex: 1 }}
                    disabled={isBusy}
                    onClick={() => setConfirmType("delete")}
                  >
                    Delete game
                  </IonButton>
                </>
              ) : (
                <IonButton
                  color="danger"
                  expand="block"
                  disabled={isBusy}
                  onClick={openLeaveConfirm}
                >
                  Leave game
                </IonButton>
              )}
            </IonFooter>
          </>
        )}
      </IonModal>

      <IonAlert
        isOpen={confirmType !== null}
        header={alertHeader()}
        message={alertMessage()}
        buttons={alertButtons()}
        onDidDismiss={() => setConfirmType(null)}
      />

      <IonToast
        isOpen={toastMessage.length > 0}
        message={toastMessage}
        duration={3500}
        onDidDismiss={() => setToastMessage("")}
      />
    </>
  );
};

export default GameDetailModal;
