import { Link } from 'react-router-dom';

interface NotFoundProps {
  message: string;
}

export function NotFound({ message }: NotFoundProps) {
  return (
    <div className="arcade-sky flex min-h-screen items-center justify-center px-4">
      <div className="ink-panel font-display rounded-2xl bg-cream p-6 text-center text-ink">
        <p className="mb-4">{message}</p>
        <Link to="/" className="ink-btn inline-block rounded-full bg-mint px-4 py-2">
          돌아가기
        </Link>
      </div>
    </div>
  );
}
