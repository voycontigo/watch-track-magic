import { useSyncExternalStore } from "react";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getNotificationPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifPermission;
}

export function useNotificationPermission(): NotifPermission {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getNotificationPermission,
    () => "unsupported" as NotifPermission,
  );
}

export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const result = (await Notification.requestPermission()) as NotifPermission;
  emit();
  return result;
}

/** Muestra una notificación del sistema (usa el service worker si está disponible). */
export async function notify(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    ...(tag ? { tag } : {}),
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* fallback abajo */
  }
  try {
    new Notification(title, options);
  } catch {
    /* ignorado */
  }
}
