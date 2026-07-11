import { Link } from 'react-router-dom';
import { stages } from '../data/stages';

export function StageSelect() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-900 to-slate-900 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-center text-3xl font-bold">히든캐치</h1>
        <p className="mb-8 text-center text-white/70">스테이지를 선택하세요</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {stages.map((stage) => (
            <Link
              key={stage.id}
              to={`/stage/${stage.id}`}
              className="group overflow-hidden rounded-2xl bg-slate-800 shadow-lg ring-1 ring-white/10 transition hover:ring-white/40"
            >
              <img
                src={stage.thumbnail}
                alt={stage.title}
                className="aspect-[3/2] w-full object-cover transition group-hover:scale-105"
              />
              <div className="px-4 py-3 text-center font-semibold">{stage.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
