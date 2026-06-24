import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-5xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Button onClick={() => navigate('/')}>Voltar ao início</Button>
    </div>
  );
}
