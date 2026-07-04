import { useCallback, useEffect, useRef, useState } from "react";

export function useSuccessFlash(duration = 2000) {
  const [success, setSuccess] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSuccess(true);
    timer.current = setTimeout(() => setSuccess(false), duration);
  }, [duration]);

  return { success, flash };
}
