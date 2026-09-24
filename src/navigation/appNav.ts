// Shared sidebar / mobile nav — used by AppLayout and CommandPalette.
import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiBarChart2,
  FiCalendar,
  FiCpu,
  FiTarget,
  FiBell,
  FiHome,
  FiLayers,
  FiLock,
  FiSettings,
  FiShield,
  FiTrendingUp,
  FiGitBranch,
} from 'react-icons/fi';
import { AiFillCalculator } from 'react-icons/ai';

export type AppNavItem = {
  to: string;
  icon: IconType;
  label: string;
  accent: string;
  bg: string;
};

export type AppNavGroup = { label: string; items: AppNavItem[] };

export const NAV_GROUPS: AppNavGroup[] = [
  {
    label: 'Portfolio',
    items: [
      {
        to: '/dashboard',
        icon: FiHome,
        label: 'Dashboard',
        accent: 'text-sky-400',
        bg: 'bg-sky-500/10',
      },
      {
        to: '/wealth',
        icon: FiLayers,
        label: 'Wealth',
        accent: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
      },
      {
        to: '/cashflow',
        icon: FiActivity,
        label: 'Cashflow',
        accent: 'text-teal-400',
        bg: 'bg-teal-500/10',
      },
      {
        to: '/payments',
        icon: FiBell,
        label: 'Bill Reminders',
        accent: 'text-sky-400',
        bg: 'bg-sky-500/10',
      },
      {
        to: '/insurance',
        icon: FiShield,
        label: 'Insurance',
        accent: 'text-blue-400',
        bg: 'bg-blue-500/10',
      },
      {
        to: '/essentials',
        icon: FiTarget,
        label: 'Essentials',
        accent: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
      },
      {
        to: '/forecast',
        icon: FiTrendingUp,
        label: 'Forecast',
        accent: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
      },
      {
        to: '/calendar',
        icon: FiCalendar,
        label: 'Calendar',
        accent: 'text-sky-400',
        bg: 'bg-sky-500/10',
      },
      {
        to: '/credentials',
        icon: FiLock,
        label: 'Credentials',
        accent: 'text-fuchsia-400',
        bg: 'bg-fuchsia-500/10',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        to: '/ai-agent',
        icon: FiCpu,
        label: 'AI Coach',
        accent: 'text-violet-400',
        bg: 'bg-violet-500/10',
      },
      {
        to: '/simulator',
        icon: FiGitBranch,
        label: 'Simulator',
        accent: 'text-fuchsia-400',
        bg: 'bg-fuchsia-500/10',
      },
      {
        to: '/cfo',
        icon: FiShield,
        label: 'Personal CFO',
        accent: 'text-amber-400',
        bg: 'bg-amber-500/10',
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        to: '/tools',
        icon: AiFillCalculator,
        label: 'Tools',
        accent: 'text-purple-400',
        bg: 'bg-purple-500/10',
      },
      {
        to: '/reports',
        icon: FiBarChart2,
        label: 'Reports',
        accent: 'text-orange-400',
        bg: 'bg-orange-500/10',
      },
    ],
  },
];

export const ALL_NAV_ITEMS: AppNavItem[] = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  {
    to: '/settings',
    icon: FiSettings,
    label: 'Settings',
    accent: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-200 dark:bg-slate-700/30',
  },
];
