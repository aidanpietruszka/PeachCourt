import './InfoCard.css';

export interface InfoRow {
  label: string;
  value: string;
}

interface InfoCardProps {
  rows: InfoRow[];
}

const InfoCard: React.FC<InfoCardProps> = ({ rows }) => (
  <div className="info-card">
    {rows.map((row) => (
      <div className="info-card__row" key={row.label}>
        <span className="info-card__label">{row.label}</span>
        <span className="info-card__value">{row.value}</span>
      </div>
    ))}
  </div>
);

export default InfoCard;