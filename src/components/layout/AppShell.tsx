import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Moon, Sun, Activity } from 'lucide-react';
import { NAV_ITEMS } from './navItems';
import { useSettings } from '@/store/settingsStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={() => setTheme(next)}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-14 items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-bold">
            <Activity className="h-5 w-5 text-primary" />
            <span>
              BTTS <span className="text-primary">Analytics Pro</span>
            </span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      {/* overflow-x-clip is a safety net against any horizontal bleed on mobile;
          `clip` (not `hidden`) doesn't create a scroll container, so sticky
          descendants like the header and the market selector keep working. */}
      <main className="container flex-1 overflow-x-clip py-4 pb-24 md:pb-8">{children}</main>

      {/* Mobile bottom navigation — a fixed grid so every destination is always
          visible (no horizontal scroll hiding items) with the active tab marked
          by a top indicator bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
                  'before:absolute before:top-0 before:h-0.5 before:w-8 before:rounded-full before:transition-colors',
                  isActive
                    ? 'text-primary before:bg-primary'
                    : 'text-muted-foreground before:bg-transparent',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="w-full truncate px-0.5 text-center">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
