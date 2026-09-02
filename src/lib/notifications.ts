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

/** Muestra una notificación del sistema que se cierra al pulsarla. */
export async function notify(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: "/icon-512.png",
    badge: "/icon-512.png",
    requireInteraction: false,
    ...(tag ? { tag } : {}),
  };

  // Preferimos la API directa: permite cerrar la notificación al hacer clic.
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignorado */
      }
      n.close();
    };
    return;
  } catch {
    /* fallback al service worker */
  }

  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, options);
  } catch {
    /* ignorado */
  }
}

/** Cierra las notificaciones abiertas (todas o las de un tag concreto). */
export async function closeNotifications(tag?: string) {
  if (typeof window === "undefined") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (!reg) return;
    const list = await reg.getNotifications(tag ? { tag } : undefined);
    list.forEach((n) => n.close());
  } catch {
    /* ignorado */
  }
}

