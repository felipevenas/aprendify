import { useEffect } from "react";
import { friendsService } from "../services/friendsService";
import { PRESENCE_HEARTBEAT_MS } from "../socialUtils";

export function usePresenceHeartbeat() {
  useEffect(() => {
    let active = true;

    const syncPresence = () => {
      const isVisible = document.visibilityState === "visible";
      void friendsService.setPresence(isVisible).catch(() => undefined);
    };

    syncPresence();
    const intervalId = window.setInterval(() => {
      if (active) syncPresence();
    }, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", syncPresence);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncPresence);
      void friendsService.setPresence(false).catch(() => undefined);
    };
  }, []);
}
