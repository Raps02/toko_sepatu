import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Toko: pengganti `useEffectEvent`, yang belum ada di React bawaan Next 15.
 * Fungsi yang dikembalikan selalu stabil dan selalu memanggil versi terbaru dari `handler`.
 */
export function useEffectEvent<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
