import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Moon, Sun, Activity, MoreHorizontal, X } from 'lucide-react';
import { NAV_ITEMS, MOBILE_PRIMARY, type NavItem } from './navItems';
import { useSettings } from '@/store/settingsStore';
import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/version';
import { cn } from '@/lib/utils';

function ThemeToggle({ className }: { className?: string }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      className={className}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <NavLink to="/" className={cn('flex items-center gap-2.5 font-bold', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
        <Activity className="h-5 w-5" />
      </span>
      <span className="text-[0.95rem] leading-none">
        BTTS <span className="text-primary">Analytics Pro</span>
      </span>
    </NavLink>
  );
}

const sidebarLink = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/12 text-primary'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  );

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary: NavItem[] = MOBILE_PRIMARY.map((to) => NAV_ITEMS.find((i) => i.to === to)!).filter(
    Boolean,
  );
  const more: NavItem[] = NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.to));
  const moreActive = more.some((i) => i.to === location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card/40 md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={sidebarLink}>
              <item.icon className="h-[1.15rem] w-[1.15rem]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">v{APP_VERSION}</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
        <Wordmark />
        <ThemeToggle />
      </header>

      {/* Main content (offset by the sidebar on desktop) */}
      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation: 4 primary destinations + "Mais" */}
      <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border md:hidden">
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
            moreActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </nav>

      {/* "Mais" bottom sheet (mobile) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 animate-in fade-in" />
          <div
            className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Mais</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar"
                onClick={() => setMoreOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {more.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-[11px] font-medium transition-colors',
                      isActive
                        ? 'border-primary/30 bg-primary/12 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
