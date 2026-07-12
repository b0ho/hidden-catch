import { Link } from 'react-router-dom';
import { categories } from '../data/categories';
import { categoryOriginalSrc } from '../lib/stagePaths';
import { countClearedInCategory, firstUnclearedOrder } from '../lib/records';

export function CategorySelect() {
  const totalStages = categories.reduce((sum, c) => sum + c.stageCount, 0);
  const totalCleared = categories.reduce((sum, c) => sum + countClearedInCategory(c.id, c.stageCount), 0);

  return (
    <div className="arcade-sky relative min-h-screen overflow-hidden px-4 py-10">
      <div className="arcade-cloud h-16 w-40" style={{ top: '6%', left: '-4%' }} />
      <div className="arcade-cloud h-20 w-56" style={{ top: '14%', right: '-6%', animationDelay: '-4s' }} />
      <div className="arcade-cloud h-12 w-32" style={{ top: '30%', left: '55%', animationDelay: '-9s' }} />

      <div className="relative mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col items-center">
          <h1
            className="font-display ink-text animate-marquee-glow rounded-full bg-bubblegum px-8 py-3 text-4xl text-white sm:text-5xl"
            style={{ WebkitTextStrokeWidth: '2.5px' }}
          >
            히든캐치
          </h1>
          <p className="font-display ink-panel mt-4 rounded-full bg-cream px-4 py-1 text-sm text-ink">
            테마를 골라 틀린 그림을 찾아보세요!
          </p>
          <p className="font-display ink-panel mt-3 rounded-full bg-mint px-4 py-1 text-xs text-ink">
            🏆 전체 진행 {totalCleared}/{totalStages}
          </p>
        </div>

        {/* flex-wrap instead of a grid: with 5 categories a 3-col grid leaves an
            unbalanced, left-hugging final row — wrapping flex items center it instead. */}
        <div className="flex flex-wrap justify-center gap-8">
          {categories.map((category) => {
            const cleared = countClearedInCategory(category.id, category.stageCount);
            const continueOrder = firstUnclearedOrder(category.id, category.stageCount);
            return (
              <div
                key={category.id}
                className="ink-panel relative w-full max-w-xs shrink-0 rounded-2xl bg-cream p-3 pb-4 sm:w-72"
              >
                <div className="ink-panel font-display absolute right-1 top-1 z-10 rounded-full bg-lemon px-2 py-0.5 text-xs text-ink">
                  {cleared}/{category.stageCount}
                </div>
                <Link to={`/category/${category.id}`} className="group block">
                  <div className="ink-panel overflow-hidden rounded-lg">
                    <img
                      src={categoryOriginalSrc(category.id)}
                      alt={category.title}
                      className="aspect-[3/2] w-full object-cover transition duration-200 group-hover:scale-105"
                    />
                  </div>
                  <div className="font-display pt-2 text-center text-lg text-ink">{category.title}</div>
                </Link>
                {continueOrder !== null ? (
                  <Link
                    to={`/stage/${category.id}/${continueOrder}`}
                    className="ink-btn font-display mt-2 block rounded-full bg-mint px-3 py-1.5 text-center text-sm text-ink"
                  >
                    ▶ 이어하기 ({continueOrder}/{category.stageCount})
                  </Link>
                ) : (
                  <div className="ink-panel font-display mt-2 rounded-full bg-lemon px-3 py-1.5 text-center text-sm text-ink">
                    🎉 전체 클리어!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
