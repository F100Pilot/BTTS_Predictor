import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * An icon-only control whose text label is hidden until the user hovers (mouse)
 * or presses-and-holds (touch). A short tap fires `onClick`; a long press only
 * reveals the label (and is swallowed so it doesn't also trigger the action).
 */
export function IconAction({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  size = 'md',
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const longPressed = useRef(false);

  const clear = (): void => {
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return; // long-press only revealed the label; don't fire the action
          }
          onClick?.();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setShow(true);
        }}
        onPointerLeave={() => {
          setShow(false);
          clear();
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          longPressed.current = false;
          timer.current = setTimeout(() => {
            longPressed.current = true;
            setShow(true);
          }, 350);
        }}
        onPointerUp={(e) => {
          clear();
          if (e.pointerType !== 'mouse' && show) setTimeout(() => setShow(false), 1000);
        }}
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-xl border transition-colors',
          size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
          active
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-40 hover:bg-card hover:text-muted-foreground',
          className,
        )}
      >
        {icon}
      </button>
      {show && (
        <span className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md">
          {label}
        </span>
      )}
    </span>
  );
}
