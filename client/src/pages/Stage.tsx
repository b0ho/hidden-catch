import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StageMeta } from '@shared/types';
import { ImagePanel } from '../game/ImagePanel';
import { useCharacterMovement } from '../game/useCharacterMovement';
import { hitTest } from '../game/hitTest';
import { useOrientation } from '../hooks/useOrientation';
import { stages } from '../data/stages';

export function Stage() {
  const { stageId } = useParams<{ stageId: string }>();
  const [meta, setMeta] = useState<StageMeta | null>(null);
  const [aspectRatio, setAspectRatio] = useState(3 / 2);
  const [foundIndices, setFoundIndices] = useState<Set<number>>(new Set());
  const direction = useOrientation();
  const { position, facing, isWalking, moveTo } = useCharacterMovement();

  const stageInfo = stages.find((s) => s.id === stageId);

  useEffect(() => {
    if (!stageId) return;
    setMeta(null);
    setFoundIndices(new Set());

    fetch(`/stages/${stageId}/meta.json`)
      .then((res) => res.json())
      .then((data: StageMeta) => setMeta(data));

    const img = new Image();
    img.onload = () => setAspectRatio(img.naturalWidth / img.naturalHeight);
    img.src = `/stages/${stageId}/original.jpg`;
  }, [stageId]);

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
    if (!meta) return;
    meta.diffs.forEach((diff, index) => {
      if (foundIndices.has(index)) return;
      if (hitTest(xFrac, yFrac, diff, aspectRatio)) {
        setFoundIndices((prev) => new Set(prev).add(index));
      }
    });
  }

  const total = meta?.diffs.length ?? 5;
  const cleared = meta !== null && foundIndices.size === total;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-900 to-slate-900 px-4 py-4 text-white sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <header className="flex items-center justify-between">
          <Link to="/" className="text-sm text-white/70 hover:text-white">
            ← 스테이지 목록
          </Link>
          <h1 className="text-lg font-bold sm:text-xl">{stageInfo.title}</h1>
          <span className="text-sm font-semibold">
            {foundIndices.size} / {total}
          </span>
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
            label="다른 그림 (클릭해서 이동)"
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

      {cleared ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 text-center shadow-2xl">
            <p className="mb-1 text-2xl font-bold">🎉 클리어!</p>
            <p className="mb-6 text-white/70">모든 다른 부분을 찾았습니다.</p>
            <div className="flex justify-center gap-3">
              <Link to="/" className="rounded-lg bg-white/10 px-4 py-2 font-medium hover:bg-white/20">
                목록으로
              </Link>
              <button
                onClick={() => setFoundIndices(new Set())}
                className="rounded-lg bg-emerald-500 px-4 py-2 font-medium hover:bg-emerald-400"
              >
                다시 플레이
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
