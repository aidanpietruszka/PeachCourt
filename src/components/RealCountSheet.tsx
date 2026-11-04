import { useState } from "react";
import { IonModal } from "@ionic/react";
import { TeamService } from "../services/TeamService";
import { CROWD_RANGES } from "../utils/crowdRange";
import { displayRange } from "../utils/crowdRange";
import "./RealCountSheet.css";

interface RealCountSheetProps {
  isOpen: boolean;
  onClose: () => void;
  courtId: string;
  currentPlayerCount: number | null;
}

const RealCountSheet: React.FC<RealCountSheetProps> = ({
  isOpen,
  onClose,
  courtId,
  currentPlayerCount,
}) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleSave = async () => {
    if (selected === null) return;
    setIsSaving(true);
    try {
      await TeamService.recordRealCount(courtId, selected);
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const subtitle =
    currentPlayerCount !== null
      ? `The app currently shows ${displayRange(currentPlayerCount)}.`
      : "No count reported yet.";

  return (
    <IonModal
      isOpen={isOpen}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6]}
      onDidDismiss={handleClose}
    >
      <div className="real-count-sheet">
        <p className="real-count-sheet__heading">Real player count</p>
        <p className="real-count-sheet__sub">{subtitle}</p>
        <div className="real-count-sheet__list">
          {CROWD_RANGES.map((range) => (
            <button
              key={range.min}
              type="button"
              className={`real-count-sheet__row${selected === range.min ? " real-count-sheet__row--selected" : ""}`}
              onClick={() => setSelected(range.min)}
            >
              <span className="real-count-sheet__label">{range.label}</span>
              <span className="real-count-sheet__count">{range.countText}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="real-count-sheet__save"
          disabled={selected === null || isSaving}
          onClick={() => void handleSave()}
        >
          Save real count
        </button>
      </div>
    </IonModal>
  );
};

export default RealCountSheet;
