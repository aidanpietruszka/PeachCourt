importScripts(
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js",
);

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

function targetUrl(data) {
  if (!data) return "/courts";
  if (data.type === "new_message" && data.gameId) {
    return "/chats/" + data.gameId + "?src=push";
  }
  if (data.gameCourtId) {
    return "/courts/" + data.gameCourtId + "?src=push";
  }
  if (data.gameId) {
    return "/courts/" + data.gameId + "?src=push";
  }
  return "/courts";
}

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "PeachCourt", {
    body: notification.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = targetUrl(event.notification.data);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
