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
import { isRouteEnabled } from '../config/featureFlags';

export type AppNavItem = {
  to: string;
  icon: IconType;
  label: string;
  accent: string;
  bg: string;
  /** Hidden behind the "More" disclosure. The nav used to advertise 14
   *  destinations, most of them re-presenting the same numbers in a different
   *  shape; the everyday screens stay visible and the occasional ones are
   *  grouped, not deleted — every route and deep link still works. */
  more?: boolean;
};

export type AppNavGroup = { label: string; items: AppNavItem[] };

/** Items parked under "More" (declared once, filtered out of the main list). */
const MORE_DESTINATIONS = [
  '/forecast',
  '/calendar',
  '/credentials',
  '/simulator',
  '/cfo',
  '/tools',
  '/reports',
];

const RAW_NAV_GROUPS: AppNavGroup[] = [
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
        label: 'Investments & loans',
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
        label: 'Upcoming bills',
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
        label: 'Goals',
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
        label: 'Monthly plan',
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

export const NAV_GROUPS: AppNavGroup[] = RAW_NAV_GROUPS.map((group) => ({
  ...group,
  items: group.items
    .filter((item) => !MORE_DESTINATIONS.includes(item.to))
    .filter((item) => isRouteEnabled(item.to))
    .map((item) => ({ ...item, more: false })),
})).filter((group) => group.items.length > 0);

/** The grouped leftovers, in the order they were listed above. */
export const MORE_ITEMS: AppNavItem[] = RAW_NAV_GROUPS.flatMap((g) => g.items)
  .filter((item) => MORE_DESTINATIONS.includes(item.to))
  .filter((item) => isRouteEnabled(item.to))
  .map((item) => ({ ...item, more: true }));

export const PRIMARY_NAV_ITEMS: AppNavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const ALL_NAV_ITEMS: AppNavItem[] = [
  ...PRIMARY_NAV_ITEMS,
  ...MORE_ITEMS,
  {
    to: '/settings',
    icon: FiSettings,
    label: 'Settings',
    accent: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-200 dark:bg-slate-700/30',
  },
];
