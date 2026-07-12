import { Link, useParams } from 'react-router-dom';
import { categories } from '../data/categories';
import { getBestTime } from '../lib/records';
import { makeStageId } from '../lib/stagePaths';
import { formatTime } from '../lib/time';
import { NotFound } from './NotFound';

export function StageList() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);

  if (!category) {
    return <NotFound message="존재하지 않는 테마입니다." />;
  }

  const bests = Array.from({ length: category.stageCount }, (_, i) =>
    getBestTime(makeStageId(category.id, i + 1)),
  );
  const tiles = bests.map((best, i) => ({
    order: i + 1,
    cleared: best !== null,
    unlocked: i === 0 || bests[i - 1] !== null,
    best,
  }));

  return (
    <div className="arcade-sky relative min-h-screen overflow-hidden px-4 py-8">
      <div className="relative mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-2">
          <Link to="/" className="font-display ink-panel rounded-full bg-cream px-3 py-1.5 text-sm text-ink">
            ◀ 테마
          </Link>
          <h1 className="font-display ink-text rounded-full bg-bubblegum px-5 py-2 text-xl text-white sm:text-2xl">
            {category.title}
          </h1>
          <span className="font-display ink-panel rounded-full bg-cream px-3 py-1.5 text-sm text-ink">
            {tiles.filter((t) => t.cleared).length}/{category.stageCount}
          </span>
        </header>

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {tiles.map((tile) =>
            tile.unlocked ? (
              <Link
                key={tile.order}
                to={`/stage/${category.id}/${tile.order}`}
                className={`ink-panel font-display flex aspect-square flex-col items-center justify-center rounded-xl text-lg text-ink transition-transform hover:-translate-y-0.5 ${
                  tile.cleared ? 'bg-mint' : 'bg-cream'
                }`}
              >
                {tile.cleared ? (
                  <>
                    <span className="text-xl">✅</span>
                    <span className="text-[0.65rem] text-ink/70">{tile.best !== null ? formatTime(tile.best) : ''}</span>
                  </>
                ) : (
                  <span>{tile.order}</span>
                )}
              </Link>
            ) : (
              <div
                key={tile.order}
                className="ink-panel font-display flex aspect-square flex-col items-center justify-center rounded-xl bg-ink/10 text-ink/40"
                aria-label={`${tile.order}번 스테이지 잠김`}
              >
                <span className="text-lg">🔒</span>
                <span className="text-[0.65rem]">{tile.order}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
