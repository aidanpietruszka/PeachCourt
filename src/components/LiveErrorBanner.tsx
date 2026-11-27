import "./LiveErrorBanner.css";

const LiveErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="live-error-banner" role="alert">
    {message}
  </div>
);

export default LiveErrorBanner;
