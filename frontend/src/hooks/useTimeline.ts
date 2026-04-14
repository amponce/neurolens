import { useCallback, useEffect, useRef, useState } from "react";

interface UseTimelineOptions {
  frameCount: number;
  fps?: number;
}

export function useTimeline({ frameCount, fps = 1 }: UseTimelineOptions) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const seek = useCallback(
    (frame: number) => {
      setFrameIndex(Math.max(0, Math.min(frame, frameCount - 1)));
    },
    [frameCount],
  );

  useEffect(() => {
    if (playing && frameCount > 0) {
      intervalRef.current = setInterval(() => {
        setFrameIndex((prev) => {
          const next = prev + 1;
          if (next >= frameCount) {
            setPlaying(false);
            return prev;
          }
          return next;
        });
      }, 1000 / fps);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, frameCount, fps]);

  return { frameIndex, playing, play, pause, toggle, seek };
}
