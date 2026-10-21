import type { OccupancyStatus } from '../types/types.ts';
import './StatusBadge.css';

const LABELS: Record<OccupancyStatus, string> = {
  open: 'Open',
  busy: 'Busy',
  full: 'Full',
};

interface StatusBadgeProps {
  status: OccupancyStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>
);

export default StatusBadge;