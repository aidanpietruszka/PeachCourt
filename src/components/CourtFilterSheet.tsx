import {
  DISTANCE_OPTIONS,
  SURFACES,
  clearFilters,
  toggleSurface,
  type CourtFilters,
  type CourtSort,
} from "../utils/courtFilters";
import "./CourtFilterSheet.css";

interface CourtFilterSheetProps {
  isOpen: boolean;
  filters: CourtFilters;
  resultCount: number;
  hasLocation: boolean;
  onChange: (update: (current: CourtFilters) => CourtFilters) => void;
  onClose: () => void;
}

type FlagKey =
  | "playersNow"
  | "openGames"
  | "openNow"
  | "lights"
  | "pickleballLines"
  | "firstCome";

const SORTS: { value: CourtSort; label: string }[] = [
  { value: "nearest", label: "Nearest" },
  { value: "players", label: "Most players" },
  { value: "games", label: "Most open games" },
];

const SHOW_ONLY: { key: FlagKey; label: string }[] = [
  { key: "playersNow", label: "Players there now" },
  { key: "openGames", label: "Has open games" },
  { key: "openNow", label: "Open now" },
];

const FEATURES: { key: FlagKey; label: string }[] = [
  { key: "lights", label: "Lights" },
  { key: "pickleballLines", label: "Pickleball lines" },
  { key: "firstCome", label: "First come, first served" },
];

interface OptionChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const OptionChip: React.FC<OptionChipProps> = ({
  label,
  selected,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    className={`filter-chip${selected ? " filter-chip--selected" : ""}`}
    aria-pressed={selected}
    disabled={disabled}
    onClick={onClick}
  >
    {label}
  </button>
);

const CourtFilterSheet: React.FC<CourtFilterSheetProps> = ({
  isOpen,
  filters,
  resultCount,
  hasLocation,
  onChange,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const toggleFlag = (key: FlagKey) =>
    onChange((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="filter-sheet">
      <div className="filter-sheet__dim" onClick={onClose} aria-hidden="true" />
      <div
        className="filter-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Filter courts"
      >
        <div className="filter-sheet__header">
          <h2 className="filter-sheet__title">Filter courts</h2>
          <button
            type="button"
            className="filter-sheet__clear"
            onClick={() => onChange(clearFilters)}
          >
            Clear all
          </button>
        </div>

        <h3 className="filter-sheet__heading">Sort by</h3>
        <div className="filter-sheet__chips">
          {SORTS.filter(
            (option) => option.value !== "nearest" || hasLocation,
          ).map((option) => (
            <OptionChip
              key={option.value}
              label={option.label}
              selected={filters.sort === option.value}
              onClick={() =>
                onChange((current) => ({ ...current, sort: option.value }))
              }
            />
          ))}
        </div>

        <h3 className="filter-sheet__heading">Show only</h3>
        <div className="filter-sheet__chips">
          {SHOW_ONLY.map((option) => (
            <OptionChip
              key={option.key}
              label={option.label}
              selected={filters[option.key]}
              onClick={() => toggleFlag(option.key)}
            />
          ))}
        </div>

        <h3 className="filter-sheet__heading">Court features</h3>
        <div className="filter-sheet__chips">
          {FEATURES.map((option) => (
            <OptionChip
              key={option.key}
              label={option.label}
              selected={filters[option.key]}
              onClick={() => toggleFlag(option.key)}
            />
          ))}
        </div>

        <h3 className="filter-sheet__heading">Surface</h3>
        <div className="filter-sheet__chips">
          {SURFACES.map((surface) => (
            <OptionChip
              key={surface}
              label={surface}
              selected={filters.surfaces.includes(surface)}
              onClick={() =>
                onChange((current) => toggleSurface(current, surface))
              }
            />
          ))}
        </div>

        <h3 className="filter-sheet__heading">Distance</h3>
        <div className="filter-sheet__chips">
          <OptionChip
            label="Any"
            selected={filters.distanceMiles === null}
            onClick={() =>
              onChange((current) => ({ ...current, distanceMiles: null }))
            }
          />
          {DISTANCE_OPTIONS.map((miles) => (
            <OptionChip
              key={miles}
              label={`${miles} mi`}
              selected={filters.distanceMiles === miles}
              disabled={!hasLocation}
              onClick={() =>
                onChange((current) => ({ ...current, distanceMiles: miles }))
              }
            />
          ))}
        </div>
        {!hasLocation && (
          <p className="filter-sheet__note">
            Allow location access to filter by distance.
          </p>
        )}

        <button type="button" className="filter-sheet__done" onClick={onClose}>
          {`Show ${resultCount} ${resultCount === 1 ? "court" : "courts"}`}
        </button>
      </div>
    </div>
  );
};

export default CourtFilterSheet;
