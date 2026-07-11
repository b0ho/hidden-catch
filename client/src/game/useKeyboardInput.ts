import { useEffect, useRef } from 'react';

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D']);
const UP_KEYS = new Set(['ArrowUp', 'w', 'W']);
const DOWN_KEYS = new Set(['ArrowDown', 's', 'S']);
const MOVE_KEYS = new Set([...LEFT_KEYS, ...RIGHT_KEYS, ...UP_KEYS, ...DOWN_KEYS]);

/** Feeds arrow-key / WASD direction into `setInput` so the character walks while a key is held. */
export function useKeyboardInput(setInput: (dx: number, dy: number) => void, enabled = true) {
  const pressedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    function publish() {
      const pressed = pressedRef.current;
      let dx = 0;
      let dy = 0;
      if ([...LEFT_KEYS].some((k) => pressed.has(k))) dx -= 1;
      if ([...RIGHT_KEYS].some((k) => pressed.has(k))) dx += 1;
      if ([...UP_KEYS].some((k) => pressed.has(k))) dy -= 1;
      if ([...DOWN_KEYS].some((k) => pressed.has(k))) dy += 1;
      setInput(dx, dy);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!MOVE_KEYS.has(event.key)) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      event.preventDefault();
      pressedRef.current.add(event.key);
      publish();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (!MOVE_KEYS.has(event.key)) return;
      pressedRef.current.delete(event.key);
      publish();
    }

    function onBlur() {
      pressedRef.current.clear();
      setInput(0, 0);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      pressedRef.current.clear();
      setInput(0, 0);
    };
  }, [setInput, enabled]);
}
