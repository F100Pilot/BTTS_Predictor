import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { APP_VERSION, WHATS_NEW } from '@/version';

const STORAGE_KEY = 'btts:lastSeenVersion';

/**
 * Shows a "what's new" popup once per version: on first launch after an update,
 * it lists the latest changes, then records the seen version so it won't repeat.
 */
export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== APP_VERSION && WHATS_NEW.length > 0) setOpen(true);
    } catch {
      // localStorage unavailable — skip silently.
    }
  }, []);

  const dismiss = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Novidades · v{APP_VERSION}
          </DialogTitle>
          <DialogDescription>O que mudou nesta atualização:</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {WHATS_NEW.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button size="sm" onClick={dismiss}>
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
