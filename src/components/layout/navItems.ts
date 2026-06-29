import { Home, History, Settings, Coins, Radio, Calculator, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Jogos', icon: Home },
  { to: '/live', label: 'Ao Vivo', icon: Radio },
  { to: '/martingale', label: 'Martingale', icon: Coins },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/calculator', label: 'Calculadora', icon: Calculator },
  { to: '/settings', label: 'Definições', icon: Settings },
];
