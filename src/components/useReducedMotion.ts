import { useEffect, useState } from "react";
import { useSave } from "../save/SaveProvider";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the OS asks for less motion or the in-app setting is on. */
export function useReducedMotion(): boolean {
  const { save } = useSave();
  const [osPrefers, setOsPrefers] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setOsPrefers(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return osPrefers || save.settings.reducedMotion;
}
