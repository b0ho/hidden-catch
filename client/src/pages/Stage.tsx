import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StageMeta } from '@shared/types';
import { ImagePanel, type HintTarget, type MissMarker } from '../game/ImagePanel';
import { Confetti } from '../game/Confetti';
import { useCharacterMovement } from '../game/useCharacterMovement';
import { useKeyboardInput } from '../game/useKeyboardInput';
import { VirtualJoystick } from '../game/VirtualJoystick';
import { hitTest } from '../game/hitTest';
import { useStageLayout } from '../hooks/useStageLayout';
import { useIsTouchDevice } from '../hooks/useIsTouchDevice';
import { categories } from '../data/categories';
import { categoryOriginalSrc, makeStageId, stageMetaSrc, stageModifiedSrc } from '../lib/stagePaths';
import { NotFound } from './NotFound';
import { formatTime } from '../lib/time';
import { getBestTime, saveBestTime } from '../lib/records';
import { isMuted, playClear, playFound, playHurry, playMiss, setMuted } from '../lib/sfx';
import { vibrateClear, vibrateFound, vibrateMiss } from '../lib/haptics';

const TIME_LIMIT_SECONDS = 180;
const MISS_PENALTY_SECONDS = 5;
const HINT_COUNT = 3;
const HINT_DISPLAY_MS = 2200;
const ZOOM_LEVELS = [1, 2, 4];
/** Shared size + bottom offset for the joystick/찾기/확대 controls so they line up in one row. */
const CONTROL_SIZE = 'h-16 w-16';
const CONTROL_BOTTOM_STYLE = { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.375rem)' };

export function Stage() {
  const { categoryId, order } = useParams<{ categoryId: string; order: string }>();
  const orderNum = Number(order);
  const category = categories.find((c) => c.id === categoryId);
  const validRoute = !!categoryId && !!category && Number.isInteger(orderNum) && orderNum >= 1 && orderNum <= category.stageCount;
  const stageId = categoryId && validRoute ? makeStageId(categoryId, orderNum) : undefined;

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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const isTouchDevice = useIsTouchDevice();
  const ready = meta !== null && imageLoaded && !loadError;

  // Measures the actual visible area (root minus header/gauge bar) and picks whichever
  // arrangement — side by side or stacked — renders the photos bigger, recomputing on any
  // resize. Replaces a fixed "desktop = row" breakpoint with a decision based on real space.
  const { direction, panelSize, rootRef, headerRef, gaugeRef } = useStageLayout(aspectRatio);
  const isRow = direction === 'row';

  const { position, facing, isWalking, moveTo, setInput, reset: resetCharacter } = useCharacterMovement(undefined, {
    aspectRatio,
    zoom: zoomLevel,
  });
  useKeyboardInput(setInput);

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
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  /** Checks a point against undiscovered diffs and marks any hit as found. Returns whether
   * a new diff was found — callers use this to apply the miss penalty. This is the only way
   * to register a find while walking via keyboard/joystick — merely passing over a spot no
   * longer counts, only an explicit click or "찾기"/space press does.
   *
   * The hit radius shrinks with zoom (in image-fraction terms) so that zooming in doesn't
   * hand out a bigger *effective* on-screen target for free — the same screen-space precision
   * is required at any zoom level, matching the slower movement speed while zoomed. */
  function checkHit(xFrac: number, yFrac: number): boolean {
    const currentMeta = metaRef.current;
    if (!currentMeta) return false;
    let foundNew = false;
    currentMeta.diffs.forEach((diff, index) => {
      if (foundRef.current.has(index)) return;
      const scaledDiff = { ...diff, radius: diff.radius / zoomRef.current };
      if (hitTest(xFrac, yFrac, scaledDiff, aspectRatioRef.current)) {
        foundNew = true;
        setFoundIndices((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
      }
    });
    if (foundNew) {
      playFound();
      vibrateFound();
    }
    return foundNew;
  }

  function applyMissPenalty(xFrac: number, yFrac: number) {
    playMiss();
    vibrateMiss();
    setTimeLeft((prev) => {
      const next = Math.max(0, prev - MISS_PENALTY_SECONDS);
      if (next === 0) setFailed(true);
      return next;
    });
    setMissMarker({ x: xFrac, y: yFrac, nonce: Date.now() });
  }

  function attemptFind(xFrac: number, yFrac: number) {
    if (!readyRef.current || failedRef.current || clearedRef.current) return;
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

  const loadStage = useCallback(() => {
    if (!categoryId || !validRoute || !stageId) return;
    setMeta(null);
    setImageLoaded(false);
    setLoadError(false);
    setFoundIndices(new Set());
    setTimeLeft(TIME_LIMIT_SECONDS);
    setFailed(false);
    setMissMarker(null);
    setHintsLeft(HINT_COUNT);
    setHintTarget(null);
    setZoomLevel(1);
    setBestTime(getBestTime(stageId));
    setIsNewRecord(false);
    resetCharacter();

    fetch(stageMetaSrc(categoryId, orderNum))
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load stage meta: ${res.status}`);
        return res.json();
      })
      .then((data: StageMeta) => setMeta(data))
      .catch(() => setLoadError(true));

    const img = new Image();
    img.onload = () => {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
      setImageLoaded(true);
    };
    img.onerror = () => setLoadError(true);
    img.src = categoryOriginalSrc(categoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, orderNum, validRoute, stageId, resetCharacter]);

  useEffect(() => {
    loadStage();
  }, [loadStage]);

  const total = meta?.diffs.length ?? 5;
  const cleared = meta !== null && foundIndices.size === total;
  const clearedRef = useRef(cleared);
  clearedRef.current = cleared;
  const failedRef = useRef(failed);
  failedRef.current = failed;
  const isUrgent = timeLeft <= 30 && !cleared && !failed;

  // Countdown ticks once per second while the stage is still in play — held off until the
  // stage data/image has actually loaded, otherwise time drains during the loading screen.
  useEffect(() => {
    if (!ready || cleared || failed) return;
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
  }, [ready, cleared, failed, stageId]);

  // Fires once when a stage is cleared: records a new best time (if any) and plays the fanfare.
  useEffect(() => {
    if (!cleared || !stageId) return;
    playClear();
    vibrateClear();
    if (saveBestTime(stageId, timeLeft)) {
      setBestTime(timeLeft);
      setIsNewRecord(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared]);

  // Fires once when time first drops into the "hurry" zone.
  useEffect(() => {
    if (isUrgent) playHurry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUrgent]);

  function handleRetry() {
    setFoundIndices(new Set());
    setTimeLeft(TIME_LIMIT_SECONDS);
    setFailed(false);
    setMissMarker(null);
    setHintsLeft(HINT_COUNT);
    setHintTarget(null);
    setIsNewRecord(false);
    setZoomLevel(1);
    resetCharacter();
  }

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  if (!validRoute || !categoryId || !category) {
    return <NotFound message="존재하지 않는 스테이지입니다." />;
  }

  const listHref = `/category/${categoryId}`;

  if (loadError) {
    return (
      <div className="arcade-sky flex min-h-screen items-center justify-center px-4">
        <div className="ink-panel font-display rounded-2xl bg-cream p-6 text-center text-ink">
          <p className="mb-4">
            스테이지를 불러오지 못했습니다.
            <br />
            네트워크 상태를 확인한 뒤 다시 시도해주세요.
          </p>
          <div className="flex justify-center gap-3">
            <Link to={listHref} className="ink-btn inline-block rounded-full bg-cream px-4 py-2">
              목록으로
            </Link>
            <button onClick={loadStage} className="ink-btn inline-block rounded-full bg-mint px-4 py-2">
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nextOrder = orderNum + 1;
  const hasNextStage = nextOrder <= category.stageCount;

  function handlePanelClick(xFrac: number, yFrac: number) {
    moveTo(xFrac, yFrac);
    attemptFind(xFrac, yFrac);
  }

  const timeRatio = timeLeft / TIME_LIMIT_SECONDS;
  const barColor = timeLeft <= 30 ? 'bg-bubblegum' : timeLeft <= 90 ? 'bg-lemon' : 'bg-mint';

  return (
    <div ref={rootRef} className="arcade-sky relative flex h-screen flex-col overflow-hidden px-2 py-2">
      {isUrgent ? (
        <div className="animate-urgent-border pointer-events-none fixed inset-0 z-20" />
      ) : null}

      {missMarker ? (
        <div
          key={missMarker.nonce}
          className="animate-miss-flash pointer-events-none fixed inset-0 z-20 bg-bubblegum-deep"
        />
      ) : null}

      <div className="relative mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col gap-2">
        <header
          ref={headerRef}
          className="flex shrink-0 flex-nowrap items-center justify-between gap-1 overflow-x-auto"
        >
          <Link
            to={listHref}
            className="font-display ink-panel shrink-0 rounded-full bg-cream px-2 py-1 text-xs text-ink"
          >
            ◀
          </Link>
          <h1 className="font-display ink-text shrink-0 rounded-full bg-bubblegum px-3 py-1 text-sm text-white sm:text-lg">
            {category.title} {orderNum}/{category.stageCount}
          </h1>
          <span
            className={`font-display ink-panel shrink-0 rounded-full px-2 py-1 text-xs text-ink sm:text-sm ${
              isUrgent ? 'animate-hurry-blink bg-bubblegum text-white' : 'bg-cream'
            }`}
          >
            ⏱️{formatTime(timeLeft)}
          </span>
          <span className="font-display ink-panel shrink-0 rounded-full bg-cream px-2 py-1 text-xs text-ink sm:text-sm">
            🎯{foundIndices.size}/{total}
          </span>
          {!isTouchDevice ? (
            <button
              onClick={() => setZoomLevel((z) => ZOOM_LEVELS[(ZOOM_LEVELS.indexOf(z) + 1) % ZOOM_LEVELS.length])}
              disabled={cleared || failed}
              className={`ink-btn font-display shrink-0 rounded-full px-2 py-1 text-xs text-ink disabled:text-ink/40 sm:text-sm ${
                zoomLevel > 1 ? 'bg-lemon' : 'bg-cream'
              }`}
            >
              🔎{zoomLevel}×
            </button>
          ) : null}
          <button
            onClick={handleHint}
            disabled={hintsLeft <= 0 || cleared || failed}
            className="ink-btn font-display shrink-0 rounded-full bg-lemon px-2 py-1 text-xs text-ink disabled:bg-cream disabled:text-ink/40 sm:text-sm"
          >
            🔍{hintsLeft}
          </button>
          <button
            onClick={toggleMuted}
            aria-label={muted ? '소리 켜기' : '소리 끄기'}
            className="ink-btn font-display shrink-0 rounded-full bg-cream px-2 py-1 text-xs text-ink sm:text-sm"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </header>

        {ready ? (
          <div
            className={`flex min-h-0 flex-1 items-center justify-center gap-2 sm:gap-3 ${
              isRow ? 'flex-row' : 'flex-col'
            }`}
          >
            <ImagePanel
              src={categoryOriginalSrc(categoryId)}
              alt="원본 그림"
              label="원본"
              aspectRatio={aspectRatio}
              zoom={zoomLevel}
              characterPosition={position}
              fit={isRow ? 'height' : 'width'}
              computedSize={panelSize}
            />
            <ImagePanel
              src={stageModifiedSrc(categoryId, orderNum)}
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
              zoom={zoomLevel}
              fit={isRow ? 'height' : 'width'}
              computedSize={panelSize}
              onPanelClick={handlePanelClick}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="ink-panel font-display rounded-2xl bg-cream px-6 py-8 text-center text-ink">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-ink/20 border-t-ink" />
              불러오는 중...
            </div>
          </div>
        )}
      </div>

      <div ref={gaugeRef} className="relative z-10 mx-auto mt-1 w-full max-w-[1600px] shrink-0 px-1">
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

      {isTouchDevice && !cleared && !failed ? (
        <div className="fixed left-1/2 z-10 -translate-x-1/2" style={CONTROL_BOTTOM_STYLE}>
          <button
            onClick={() => setZoomLevel((z) => ZOOM_LEVELS[(ZOOM_LEVELS.indexOf(z) + 1) % ZOOM_LEVELS.length])}
            className={`ink-btn font-display ${CONTROL_SIZE} rounded-full text-base text-ink ${
              zoomLevel > 1 ? 'bg-lemon' : 'bg-cream'
            }`}
          >
            {zoomLevel}×
          </button>
        </div>
      ) : null}

      {isTouchDevice && !cleared && !failed ? (
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
          <Confetti />
          <div className="ink-panel relative w-full max-w-sm rounded-2xl bg-cream p-6 text-center">
            <p className="font-display mb-1 text-3xl text-ink">🎉 클리어!</p>
            <p className="mb-2 text-ink/70">모든 다른 부분을 찾았습니다. (남은 시간 {formatTime(timeLeft)})</p>
            {bestTime !== null ? (
              <p className={`font-display mb-6 text-sm ${isNewRecord ? 'text-bubblegum-deep' : 'text-ink/70'}`}>
                {isNewRecord ? `🏆 신기록! (${formatTime(bestTime)})` : `🏆 최고기록 ${formatTime(bestTime)}`}
              </p>
            ) : (
              <div className="mb-6" />
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={listHref} className="ink-btn font-display rounded-full bg-cream px-4 py-2 text-ink">
                목록으로
              </Link>
              <button onClick={handleRetry} className="ink-btn font-display rounded-full bg-mint px-4 py-2 text-ink">
                다시 플레이
              </button>
              {hasNextStage ? (
                <Link
                  to={`/stage/${categoryId}/${nextOrder}`}
                  className="ink-btn font-display rounded-full bg-lemon px-4 py-2 text-ink"
                >
                  다음 스테이지 ▶
                </Link>
              ) : null}
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
              <Link to={listHref} className="ink-btn font-display rounded-full bg-cream px-4 py-2 text-ink">
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
