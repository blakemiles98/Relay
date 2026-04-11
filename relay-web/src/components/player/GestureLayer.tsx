'use client';

import { useCallback, useRef } from 'react';

interface GestureLayerProps {
  onDoubleTapLeft: () => void;
  onDoubleTapRight: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onTap: () => void;
  children?: React.ReactNode;
}

const DOUBLE_TAP_MS = 300;
const HOLD_MS = 500;

export function GestureLayer({
  onDoubleTapLeft,
  onDoubleTapRight,
  onHoldStart,
  onHoldEnd,
  onTap,
  children,
}: GestureLayerProps) {
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFiredRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const side: 'left' | 'right' = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';

      holdFiredRef.current = false;
      holdTimerRef.current = setTimeout(() => {
        holdFiredRef.current = true;
        onHoldStart();
      }, HOLD_MS);

      const now = Date.now();
      const last = lastTapRef.current;

      if (last && now - last.time < DOUBLE_TAP_MS && last.side === side) {
        // Double tap
        lastTapRef.current = null;
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (side === 'left') onDoubleTapLeft();
        else onDoubleTapRight();
      } else {
        lastTapRef.current = { time: now, side };
      }
    },
    [onDoubleTapLeft, onDoubleTapRight, onHoldStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

      if (holdFiredRef.current) {
        holdFiredRef.current = false;
        onHoldEnd();
        return;
      }

      // Single tap fires after double-tap window
      const last = lastTapRef.current;
      if (last) {
        setTimeout(() => {
          if (lastTapRef.current === last) {
            lastTapRef.current = null;
            onTap();
          }
        }, DOUBLE_TAP_MS);
      }
    },
    [onHoldEnd, onTap]
  );

  const handlePointerCancel = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdFiredRef.current) {
      holdFiredRef.current = false;
      onHoldEnd();
    }
  }, [onHoldEnd]);

  return (
    <div
      className="absolute inset-0 z-10 no-select"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
}
