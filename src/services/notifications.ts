import { createLogger } from '@/services/logger';

const log = createLogger('notifications');

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

/** Ask the user for permission. Returns the resulting permission. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (err) {
    log.warn('permission request failed', err);
    return 'denied';
  }
}

export interface NotifyOptions {
  body?: string;
  tag?: string; // dedupes/replaces notifications with the same tag
}

/**
 * Show a notification. Prefers the service-worker registration (works when the
 * PWA is installed / backgrounded); falls back to a page Notification.
 */
export async function showNotification(title: string, options: NotifyOptions = {}): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const payload: NotificationOptions = {
    body: options.body,
    tag: options.tag,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, payload);
      return;
    }
  } catch (err) {
    log.debug('SW notification failed, falling back', err);
  }
  try {
    new Notification(title, payload);
  } catch (err) {
    log.warn('notification failed', err);
  }
}
