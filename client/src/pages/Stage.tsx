import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StageMeta } from '@shared/types';
import { ImagePanel } from '../game/ImagePanel';
import { useCharacterMovement } from '../game/useCharacterMovement';
import { useKeyboardInput } from '../game/useKeyboardInput';
import { VirtualJoystick } from '../game/VirtualJoystick';
import { hitTest } from '../game/hitTest';
import { useOrientation } from '../hooks/useOrientation';
import { useIsTouchDevice } from '../hooks/useIsTouchDevice';
import { stages } from '../data/stages';

const TIME_LIMIT_SECONDS = 180;
const MISS_PENALTY_SECONDS = 5;

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
  // Incrementing counter, not a boolean, so the flash/toast animation restarts on every
  // miss even if two misses happen close together (React remounts on `key` change).
  const [missPulse, setMissPulse] = useState(0);
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

  function applyMissPenalty() {
    setTimeLeft((prev) => {
      const next = Math.max(0, prev - MISS_PENALTY_SECONDS);
      if (next === 0) setFailed(true);
      return next;
    });
    setMissPulse((n) => n + 1);
  }

  function attemptFind(xFrac: number, yFrac: number) {
    if (failedRef.current || clearedRef.current) return;
    if (!checkHit(xFrac, yFrac)) applyMissPenalty();
  }

  function handleFind() {
    attemptFind(positionRef.current.x, positionRef.current.y);
  }

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
    setMissPulse(0);

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
    setMissPulse(0);
  }

  if (!stageId || !stageInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p>
          존재하지 않는 스테이지입니다.{' '}
          <Link to="/" className="underline">
            돌아가기
          </Link>
        </p>
      </div>
    );
  }

  function handlePanelClick(xFrac: number, yFrac: number) {
    moveTo(xFrac, yFrac);
    attemptFind(xFrac, yFrac);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-900 to-slate-900 px-4 py-4 text-white sm:py-8">
      {missPulse > 0 ? (
        <div
          key={missPulse}
          className="animate-miss-flash pointer-events-none fixed inset-0 z-20 bg-red-600"
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <header className="flex items-center justify-between">
          <Link to="/" className="text-sm text-white/70 hover:text-white">
            ← 스테이지 목록
          </Link>
          <h1 className="text-lg font-bold sm:text-xl">{stageInfo.title}</h1>
          <div className="relative flex flex-col items-end text-sm font-semibold">
            <span className={timeLeft <= 30 ? 'text-red-400' : ''}>{formatTime(timeLeft)}</span>
            <span>{foundIndices.size} / {total}</span>
            {missPulse > 0 ? (
              <span
                key={missPulse}
                className="animate-miss-toast pointer-events-none absolute -bottom-1 right-0 font-bold text-red-400"
              >
                -5초
              </span>
            ) : null}
          </div>
        </header>

        <div className={`flex flex-1 gap-4 ${direction === 'stack' ? 'flex-col' : 'flex-row'}`}>
          <ImagePanel
            src={`/stages/${stageId}/original.jpg`}
            alt="원본 그림"
            label="원본"
            aspectRatio={aspectRatio}
          />
          <ImagePanel
            src={`/stages/${stageId}/modified.jpg`}
            alt="다른 부분을 찾아 클릭하세요"
            label={
              isTouchDevice
                ? '다른 그림 (터치로 클릭 이동, 조이스틱+찾기 버튼으로 걷기)'
                : '다른 그림 (클릭으로 바로 찾기, 방향키+Space로 걷다가 찾기)'
            }
            aspectRatio={aspectRatio}
            interactive
            diffs={meta?.diffs}
            foundIndices={foundIndices}
            characterPosition={position}
            characterFacing={facing}
            characterWalking={isWalking}
            onPanelClick={handlePanelClick}
          />
        </div>
      </div>

      {isTouchDevice && !cleared && !failed ? (
        <div className="fixed bottom-6 left-6 z-10">
          <VirtualJoystick onChange={setInput} />
        </div>
      ) : null}

      {!cleared && !failed ? (
        <div className="fixed bottom-6 right-6 z-10">
          <button
            onClick={handleFind}
            className="h-24 w-24 rounded-full bg-emerald-500/90 text-lg font-bold text-white shadow-lg ring-2 ring-white/30 active:scale-95"
          >
            찾기
          </button>
        </div>
      ) : null}

      {cleared ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 text-center shadow-2xl">
            <p className="mb-1 text-2xl font-bold">🎉 클리어!</p>
            <p className="mb-6 text-white/70">모든 다른 부분을 찾았습니다. (남은 시간 {formatTime(timeLeft)})</p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="rounded-lg bg-white/10 px-4 py-2 font-medium hover:bg-white/20">
                목록으로
              </Link>
              <button
                onClick={handleRetry}
                className="rounded-lg bg-emerald-500 px-4 py-2 font-medium hover:bg-emerald-400"
              >
                다시 플레이
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 text-center shadow-2xl">
            <p className="mb-1 text-2xl font-bold">⏱️ 시간 초과!</p>
            <p className="mb-6 text-white/70">
              시간 안에 다 찾지 못했습니다 ({foundIndices.size} / {total}). 다시 도전해보세요.
            </p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="rounded-lg bg-white/10 px-4 py-2 font-medium hover:bg-white/20">
                목록으로
              </Link>
              <button
                onClick={handleRetry}
                className="rounded-lg bg-emerald-500 px-4 py-2 font-medium hover:bg-emerald-400"
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
