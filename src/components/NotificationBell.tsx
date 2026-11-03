import "./NotificationBell.css";

interface Props {
  unreadCount: number;
  onClick: () => void;
}

const NotificationBell: React.FC<Props> = ({ unreadCount, onClick }) => (
  <button
    type="button"
    className="notif-bell"
    onClick={onClick}
    aria-label={
      unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"
    }
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
        fill="currentColor"
      />
    </svg>
    {unreadCount > 0 && (
      <span className="notif-bell__badge" aria-hidden="true">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    )}
  </button>
);

export default NotificationBell;
