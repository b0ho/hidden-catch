import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StageMeta } from '@shared/types';
import { ImagePanel, type HintTarget, type MissMarker } from '../game/ImagePanel';
import { useCharacterMovement } from '../game/useCharacterMovement';
import { useKeyboardInput } from '../game/useKeyboardInput';
import { VirtualJoystick } from '../game/VirtualJoystick';
import { hitTest } from '../game/hitTest';
import { useOrientation } from '../hooks/useOrientation';
import { useIsTouchDevice } from '../hooks/useIsTouchDevice';
import { stages } from '../data/stages';

const TIME_LIMIT_SECONDS = 180;
const MISS_PENALTY_SECONDS = 5;
const HINT_COUNT = 3;
const HINT_DISPLAY_MS = 2200;
/** Shared size + bottom offset for the joystick/찾기/확대 controls so they line up in one row. */
const CONTROL_SIZE = 'h-16 w-16';
const CONTROL_BOTTOM_STYLE = { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.375rem)' };

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Stage() {
  const { stageId } = useParams<{ stageId: string }>();
  const [meta, setMeta] = useState<StageMeta | null>(null);
  const [aspectRatio, setAspectRatio] = useState(3 / 2);
  const [foundIndices, setFoundIndices] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_SECONDS);
  const [failed, setFailed] = useState(false);
  // Where the last miss happened — click position for a click, character position for
  // Space/찾기 (both funnel through attemptFind with the character's own coordinates).
  // `nonce` is unique per miss so the fade/float animation restarts even for back-to-back
  // misses at the same spot (React remounts on `key` change).
  const [missMarker, setMissMarker] = useState<MissMarker | null>(null);
  const [hintsLeft, setHintsLeft] = useState(HINT_COUNT);
  const [hintTarget, setHintTarget] = useState<HintTarget | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const direction = useOrientation();
  const isTouchDevice = useIsTouchDevice();

  const { position, facing, isWalking, moveTo, setInput } = useCharacterMovement(undefined, { aspectRatio });
  useKeyboardInput(setInput);

  const stageInfo = stages.find((s) => s.id === stageId);

  // Refs so the space-bar listener (registered once) always reads the latest
  // stage data and character position without needing to re-subscribe every frame.
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const foundRef = useRef(foundIndices);
  foundRef.current = foundIndices;
  const positionRef = useRef(position);
  positionRef.current = position;
  const aspectRatioRef = useRef(aspectRatio);
  aspectRatioRef.current = aspectRatio;

  /** Checks a point against undiscovered diffs and marks any hit as found. Returns whether
   * a new diff was found — callers use this to apply the miss penalty. This is the only way
   * to register a find while walking via keyboard/joystick — merely passing over a spot no
   * longer counts, only an explicit click or "찾기"/space press does. */
  function checkHit(xFrac: number, yFrac: number): boolean {
    const currentMeta = metaRef.current;
    if (!currentMeta) return false;
    let foundNew = false;
    currentMeta.diffs.forEach((diff, index) => {
      if (foundRef.current.has(index)) return;
      if (hitTest(xFrac, yFrac, diff, aspectRatioRef.current)) {
        foundNew = true;
        setFoundIndices((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
      }
    });
    return foundNew;
  }

  function applyMissPenalty(xFrac: number, yFrac: number) {
    setTimeLeft((prev) => {
      const next = Math.max(0, prev - MISS_PENALTY_SECONDS);
      if (next === 0) setFailed(true);
      return next;
    });
    setMissMarker({ x: xFrac, y: yFrac, nonce: Date.now() });
  }

  function attemptFind(xFrac: number, yFrac: number) {
    if (failedRef.current || clearedRef.current) return;
    if (!checkHit(xFrac, yFrac)) applyMissPenalty(xFrac, yFrac);
  }

  function handleFind() {
    attemptFind(positionRef.current.x, positionRef.current.y);
  }

  /** Reveals one random undiscovered diff with a ping animation — doesn't move the
   * character or count as a find, just shows where to go. Limited to HINT_COUNT per stage. */
  function handleHint() {
    if (hintsLeft <= 0 || failedRef.current || clearedRef.current) return;
    const currentMeta = metaRef.current;
    if (!currentMeta) return;
    const undiscovered = currentMeta.diffs
      .map((diff, index) => ({ diff, index }))
      .filter(({ index }) => !foundRef.current.has(index));
    if (undiscovered.length === 0) return;
    const pick = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    setHintsLeft((n) => n - 1);
    setHintTarget({ x: pick.diff.x, y: pick.diff.y, radius: pick.diff.radius, nonce: Date.now() });
  }

  useEffect(() => {
    if (!hintTarget) return;
    const id = window.setTimeout(() => setHintTarget(null), HINT_DISPLAY_MS);
    return () => window.clearTimeout(id);
  }, [hintTarget]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      event.preventDefault();
      handleFind();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!stageId) return;
    setMeta(null);
    setFoundIndices(new Set());
    setTimeLeft(TIME_LIMIT_SECONDS);
    setFailed(false);
    setMissMarker(null);
    setHintsLeft(HINT_COUNT);
    setHintTarget(null);
    setZoomed(false);

    fetch(`/stages/${stageId}/meta.json`)
      .then((res) => res.json())
      .then((data: StageMeta) => setMeta(data));

    const img = new Image();
    img.onload = () => setAspectRatio(img.naturalWidth / img.naturalHeight);
    img.src = `/stages/${stageId}/original.jpg`;
  }, [stageId]);

  const total = meta?.diffs.length ?? 5;
  const cleared = meta !== null && foundIndices.size === total;
  const clearedRef = useRef(cleared);
  clearedRef.current = cleared;
  const failedRef = useRef(failed);
  failedRef.current = failed;

  // Countdown ticks once per second while the stage is still in play.
  useEffect(() => {
    if (cleared || failed) return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setFailed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [cleared, failed, stageId]);

  function handleRetry() {
    setFoundIndices(new Set());
    setTimeLeft(TIME_LIMIT_SECONDS);
    setFailed(false);
    setMissMarker(null);
    setHintsLeft(HINT_COUNT);
    setHintTarget(null);
  }

  if (!stageId || !stageInfo) {
    return (
      <div className="arcade-sky flex min-h-screen items-center justify-center px-4">
        <div className="ink-panel font-display rounded-2xl bg-cream p-6 text-center text-ink">
          <p className="mb-4">존재하지 않는 스테이지입니다.</p>
          <Link to="/" className="ink-btn inline-block rounded-full bg-mint px-4 py-2">
            돌아가기
          </Link>
        </div>
      </div>
    );
  }

  function handlePanelClick(xFrac: number, yFrac: number) {
    moveTo(xFrac, yFrac);
    attemptFind(xFrac, yFrac);
  }

  const timeRatio = timeLeft / TIME_LIMIT_SECONDS;
  const barColor = timeLeft <= 30 ? 'bg-bubblegum' : timeLeft <= 90 ? 'bg-lemon' : 'bg-mint';

  return (
    <div className="arcade-sky relative flex min-h-screen flex-col overflow-hidden px-3 py-4 sm:px-4 sm:py-6">
      {missMarker ? (
        <div
          key={missMarker.nonce}
          className="animate-miss-flash pointer-events-none fixed inset-0 z-20 bg-bubblegum-deep"
        />
      ) : null}

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-2">
        <header className="flex flex-nowrap items-center justify-between gap-1 overflow-x-auto">
          <Link
            to="/"
            className="font-display ink-panel shrink-0 rounded-full bg-cream px-2 py-1 text-xs text-ink"
          >
            ◀
          </Link>
          <h1 className="font-display ink-text shrink-0 rounded-full bg-bubblegum px-3 py-1 text-sm text-white sm:text-lg">
            {stageInfo.title}
          </h1>
          <span
            className={`font-display ink-panel shrink-0 rounded-full px-2 py-1 text-xs text-ink sm:text-sm ${
              timeLeft <= 30 ? 'bg-bubblegum text-white' : 'bg-cream'
            }`}
          >
            ⏱️{formatTime(timeLeft)}
          </span>
          <span className="font-display ink-panel shrink-0 rounded-full bg-cream px-2 py-1 text-xs text-ink sm:text-sm">
            🎯{foundIndices.size}/{total}
          </span>
          <button
            onClick={handleHint}
            disabled={hintsLeft <= 0 || cleared || failed}
            className="ink-btn font-display shrink-0 rounded-full bg-lemon px-2 py-1 text-xs text-ink disabled:bg-cream disabled:text-ink/40 sm:text-sm"
          >
            🔍{hintsLeft}
          </button>
        </header>

        <div className={`flex gap-2 sm:gap-3 ${direction === 'stack' ? 'flex-col' : 'flex-row'}`}>
          <ImagePanel
            src={`/stages/${stageId}/original.jpg`}
            alt="원본 그림"
            label="원본"
            aspectRatio={aspectRatio}
            zoomed={zoomed}
            characterPosition={position}
          />
          <ImagePanel
            src={`/stages/${stageId}/modified.jpg`}
            alt="다른 부분을 찾아 클릭하세요"
            label={
              isTouchDevice
                ? '터치로 이동 · 조이스틱+찾기로 걷다 찾기'
                : '클릭으로 바로 찾기 · 방향키+Space로 걷다 찾기'
            }
            aspectRatio={aspectRatio}
            interactive
            diffs={meta?.diffs}
            foundIndices={foundIndices}
            characterPosition={position}
            characterFacing={facing}
            characterWalking={isWalking}
            missMarker={missMarker}
            hintTarget={hintTarget}
            zoomed={zoomed}
            onPanelClick={handlePanelClick}
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-4 w-full max-w-5xl px-1">
        <div className="ink-panel h-4 w-full overflow-hidden rounded-full bg-cream">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${barColor}`}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>
      </div>

      {isTouchDevice && !cleared && !failed ? (
        <div className="fixed left-2 z-10" style={CONTROL_BOTTOM_STYLE}>
          <VirtualJoystick onChange={setInput} />
        </div>
      ) : null}

      {!cleared && !failed ? (
        <div className="fixed left-1/2 z-10 -translate-x-1/2" style={CONTROL_BOTTOM_STYLE}>
          <button
            onClick={() => setZoomed((z) => !z)}
            className={`ink-btn font-display ${CONTROL_SIZE} rounded-full text-base text-ink ${
              zoomed ? 'bg-lemon' : 'bg-cream'
            }`}
          >
            {zoomed ? '1×' : '2×'}
          </button>
        </div>
      ) : null}

      {!cleared && !failed ? (
        <div className="fixed right-2 z-10" style={CONTROL_BOTTOM_STYLE}>
          <button
            onClick={handleFind}
            className={`ink-btn font-display ${CONTROL_SIZE} rounded-full bg-mint text-lg text-ink`}
          >
            찾기
          </button>
        </div>
      ) : null}

      {cleared ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/60 px-4">
          <div className="ink-panel w-full max-w-sm rounded-2xl bg-cream p-6 text-center">
            <p className="font-display mb-1 text-3xl text-ink">🎉 클리어!</p>
            <p className="mb-6 text-ink/70">모든 다른 부분을 찾았습니다. (남은 시간 {formatTime(timeLeft)})</p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="ink-btn font-display rounded-full bg-cream px-4 py-2 text-ink">
                목록으로
              </Link>
              <button
                onClick={handleRetry}
                className="ink-btn font-display rounded-full bg-mint px-4 py-2 text-ink"
              >
                다시 플레이
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/60 px-4">
          <div className="ink-panel w-full max-w-sm rounded-2xl bg-cream p-6 text-center">
            <p className="font-display mb-1 text-3xl text-ink">⏱️ 시간 초과!</p>
            <p className="mb-6 text-ink/70">
              시간 안에 다 찾지 못했습니다 ({foundIndices.size} / {total}). 다시 도전해보세요.
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="ink-btn font-display rounded-full bg-cream px-4 py-2 text-ink">
                목록으로
              </Link>
              <button
                onClick={handleRetry}
                className="ink-btn font-display rounded-full bg-bubblegum px-4 py-2 text-white"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
