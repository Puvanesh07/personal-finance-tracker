import type { Timestamp } from 'firebase/firestore';

export type SubscriptionPlan = 'trial' | 'monthly' | 'yearly' | 'lifetime';

export type SubscriptionStatus = 'active' | 'expired';

export interface UserSubscriptionDoc {
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  authProvider?: 'google' | 'email';
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialStart: Timestamp | Date | string | null;
  trialEnd: Timestamp | Date | string | null;
  expiresAt: Timestamp | Date | string | null;
  gracePeriodEnd: Timestamp | Date | string | null;
  paymentId: string | null;
  /** Owner-granted complimentary premium — no payment required */
  premiumGranted?: boolean;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export type PaidPlan = Exclude<SubscriptionPlan, 'trial'>;

export interface SubscriptionNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: Date;
}

export interface PricingPlan {
  id: PaidPlan;
  name: string;
  price: number;
  priceLabel: string;
  period: string;
  description: string;
  recommended?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 99,
    priceLabel: '₹99',
    period: '/month',
    description: 'Full premium access, billed monthly',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 599,
    priceLabel: '₹599',
    period: '/year',
    description: 'Best value — save over 30%',
    recommended: true,
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: 899,
    priceLabel: '₹899',
    period: ' one-time',
    description: 'Pay once, use forever',
  },
];

export const FREE_ACCOUNT_LIMIT = 3;
export const FREE_CATEGORY_LIMIT = 10;
export const TRIAL_DAYS = 7;
export const GRACE_PERIOD_DAYS = 30;

export type PremiumFeature =
  | 'portfolio_analytics'
  | 'export'
  | 'ai_insights'
  | 'advanced_reports'
  | 'cloud_backup'
  | 'unlimited_accounts'
  | 'unlimited_categories';
