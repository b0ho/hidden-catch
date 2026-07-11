import { useRef, useState } from 'react';

interface VirtualJoystickProps {
  onChange: (dx: number, dy: number) => void;
}

const MAX_TRAVEL = 40; // px the knob can move from center

export function VirtualJoystick({ onChange }: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function updateFromPointer(clientX: number, clientY: number) {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_TRAVEL) {
      dx = (dx / dist) * MAX_TRAVEL;
      dy = (dy / dist) * MAX_TRAVEL;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / MAX_TRAVEL, dy / MAX_TRAVEL);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerIdRef.current = event.pointerId;
    updateFromPointer(event.clientX, event.clientY);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    updateFromPointer(event.clientX, event.clientY);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative h-24 w-24 touch-none select-none rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-sm"
      aria-label="이동 조이스틱"
      role="slider"
      aria-valuenow={0}
    >
      <div
        className="absolute left-1/2 top-1/2 h-10 w-10 rounded-full bg-white/80 shadow-lg transition-transform duration-75"
        style={{ transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
