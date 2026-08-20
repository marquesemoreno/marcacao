/**
 * Helper para Notificações de Desktop (Browser Notification API)
 * e gestão do título da aba do navegador.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function showDesktopNotification(
  title: string,
  options?: {
    body?: string;
    onClick?: () => void;
  }
) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        body: options?.body || "Nova mensagem recebida no WhatsApp",
        icon: "/icon.svg",
        tag: "whatsapp-chat-notification",
      });

      notification.onclick = () => {
        window.focus();
        if (options?.onClick) {
          options.onClick();
        }
        notification.close();
      };
    } catch (err) {
      console.warn("Erro ao disparar notificação de desktop:", err);
    }
  }
}

export function updateTabTitleUnreadCount(unreadCount: number) {
  if (typeof document === "undefined") return;

  const baseTitle = "Chat / WhatsApp | Conecta Saúde";
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}
