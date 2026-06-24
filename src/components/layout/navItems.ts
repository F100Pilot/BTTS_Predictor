import { Home, Star, Eye, History, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Jogos de Hoje', icon: Home },
  { to: '/favorites', label: 'Favoritos', icon: Star },
  { to: '/watchlist', label: 'Watchlist', icon: Eye },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/settings', label: 'Definições', icon: Settings },
];
