import { Home, Star, Eye, History, Settings, Coins, Radio, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Jogos', icon: Home },
  { to: '/live', label: 'Ao Vivo', icon: Radio },
  { to: '/martingale', label: 'Martingale', icon: Coins },
  { to: '/favorites', label: 'Favoritos', icon: Star },
  { to: '/watchlist', label: 'Watchlist', icon: Eye },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/settings', label: 'Definições', icon: Settings },
];
