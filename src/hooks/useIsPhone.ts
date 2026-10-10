import { useEffect, useState } from "react";

const QUERY = "(max-width: 639px)";

/**
 * Below the sm breakpoint dialogs become bottom sheets and toasts sit above the tab bar.
 * False on the server and on first paint; dialogs only open after an interaction, by
 * which time it has settled.
 */
export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return phone;
}
