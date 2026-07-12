import { Link } from 'react-router-dom';
import { stages } from '../data/stages';
import { getBestTime } from '../lib/records';
import { formatTime } from '../lib/time';

export function StageSelect() {
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
            스테이지를 골라 틀린 그림을 찾아보세요!
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {stages.map((stage) => {
            const best = getBestTime(stage.id);
            return (
              <Link
                key={stage.id}
                to={`/stage/${stage.id}`}
                className="ink-panel group relative block rounded-2xl bg-cream p-3 pb-4 transition-transform duration-150 hover:-translate-y-1 active:translate-y-0"
              >
                {best !== null ? (
                  <div className="ink-panel font-display absolute right-1 top-1 z-10 rounded-full bg-lemon px-2 py-0.5 text-xs text-ink">
                    🏆{formatTime(best)}
                  </div>
                ) : null}
                <div className="ink-panel overflow-hidden rounded-lg">
                  <img
                    src={stage.thumbnail}
                    alt={stage.title}
                    className="aspect-[3/2] w-full object-cover transition duration-200 group-hover:scale-105"
                  />
                </div>
                <div className="font-display pt-2 text-center text-lg text-ink">{stage.title}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
