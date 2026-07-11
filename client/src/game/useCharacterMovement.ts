import { useCallback, useEffect, useRef, useState } from 'react';

export interface CharacterPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: CharacterPosition = { x: 0.5, y: 0.9 };

/** Fraction of panel width the character crosses per second. */
const SPEED = 0.55;

interface UseCharacterMovementOptions {
  /** Panel width / height, used so vertical speed matches horizontal speed visually. */
  aspectRatio?: number;
  /** Current zoom level (1 = no zoom). Speed is divided by this, so movement is slower
   * and more precise the more zoomed in the player is. */
  zoom?: number;
}

export function useCharacterMovement(
  initial: CharacterPosition = DEFAULT_POSITION,
  { aspectRatio = 1, zoom = 1 }: UseCharacterMovementOptions = {},
) {
  const [position, setPosition] = useState<CharacterPosition>(initial);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const [isWalking, setIsWalking] = useState(false);

  const positionRef = useRef(position);
  const targetRef = useRef<CharacterPosition | null>(null);
  const inputRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const aspectRatioRef = useRef(aspectRatio);
  const zoomRef = useRef(zoom);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  aspectRatioRef.current = aspectRatio;
  zoomRef.current = zoom;

  useEffect(() => {
    function tick(ts: number) {
      const last = lastTsRef.current ?? ts;
      const dt = Math.min((ts - last) / 1000, 0.05);
      lastTsRef.current = ts;
      const ratio = aspectRatioRef.current;
      const speed = SPEED / zoomRef.current;

      const { dx: inputDx, dy: inputDy } = inputRef.current;
      let nx = positionRef.current.x;
      let ny = positionRef.current.y;
      let moved = false;

      if (inputDx !== 0 || inputDy !== 0) {
        targetRef.current = null;
        const len = Math.hypot(inputDx, inputDy) || 1;
        nx += (inputDx / len) * speed * dt;
        ny += ((inputDy / len) * speed * dt) / ratio;
        moved = true;
      } else if (targetRef.current) {
        const dxT = targetRef.current.x - nx;
        const dyT = (targetRef.current.y - ny) * ratio;
        const dist = Math.hypot(dxT, dyT);
        const step = speed * dt;
        if (dist <= step || dist === 0) {
          nx = targetRef.current.x;
          ny = targetRef.current.y;
          targetRef.current = null;
        } else {
          nx += (dxT / dist) * step;
          ny += ((dyT / dist) * step) / ratio;
        }
        moved = true;
      }

      if (moved) {
        nx = Math.min(1, Math.max(0, nx));
        ny = Math.min(1, Math.max(0, ny));
        const dxFacing = nx - positionRef.current.x;
        positionRef.current = { x: nx, y: ny };
        setPosition(positionRef.current);
        setIsWalking(true);
        if (Math.abs(dxFacing) > 0.0005) {
          setFacing(dxFacing >= 0 ? 'right' : 'left');
        }
      } else {
        setIsWalking(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /** Click/tap target — character walks toward it at normal speed. */
  const moveTo = useCallback((x: number, y: number) => {
    targetRef.current = { x, y };
  }, []);

  /** Continuous directional input from keyboard or a virtual joystick, each axis in [-1, 1]. */
  const setInput = useCallback((dx: number, dy: number) => {
    inputRef.current = { dx, dy };
  }, []);

  return { position, facing, isWalking, moveTo, setInput };
}
