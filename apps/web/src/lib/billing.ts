'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClient } from './api-client';

export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type BillingInterval = 'monthly' | 'yearly';
export type PaymentProvider = 'stripe' | 'razorpay' | 'paypal';
export interface BillingPlan {
  id: string; tier: PlanTier; name: string; priceMonthly: number; priceYearly: number;
  description: string; popular?: boolean;
  limits: { maxFileSizeMb: number; dailyConversions: number; batchLimit: number; ocrEnabled: boolean; aiQueries: number };
}
export interface BillingProviders {
  stripe: boolean; razorpay: boolean; paypal: boolean; providers: PaymentProvider[];
  razorpayPrices?: Record<string, number>;
}
export interface BillingSubscription {
  id: string; plan: PlanTier; interval: string; provider: string; status: string;
  currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean;
  canceledAt?: string | null; stripeSubscriptionId?: string | null;
  razorpaySubscriptionId?: string | null; paypalSubscriptionId?: string | null; createdAt?: string;
}
export interface BillingPayment {
  id: string; amount: number; currency: string; status: string; provider: string;
  receiptUrl?: string | null; createdAt: string;
}
export interface BillingInvoice {
  id: string; invoiceNumber: string; amount: number; currency: string; status: string; createdAt: string;
}
export interface BillingHistory {
  currentPlan: PlanTier; subscription: BillingSubscription | null;
  subscriptions: BillingSubscription[]; payments: BillingPayment[]; invoices: BillingInvoice[];
}
export const PLAN_ORDER: PlanTier[] = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
export function formatMoney(amount: number, currency = 'USD') {
  if (!Number.isFinite(Number(amount))) return 'Unavailable';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: Number(amount) % 1 ? 2 : 0 }).format(Number(amount)); }
  catch { return `${currency} ${Number(amount).toFixed(2)}`; }
}
export function formatDate(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not available';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function selectCurrentSubscription(history: BillingHistory, now = Date.now()) {
  return (history.subscriptions || []).find(sub => sub.plan === history.currentPlan &&
    ['ACTIVE', 'TRIALING'].includes(sub.status) && new Date(sub.currentPeriodStart).getTime() <= now &&
    new Date(sub.currentPeriodEnd).getTime() > now) || null;
}
export function razorpayPrice(providers: BillingProviders, tier: PlanTier, interval: BillingInterval) {
  const amount = providers.razorpayPrices?.[`${tier}_${interval.toUpperCase()}`];
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}
export function availableProviders(providers: BillingProviders, tier: PlanTier, interval: BillingInterval) {
  return (['stripe', 'razorpay', 'paypal'] as PaymentProvider[]).filter(provider =>
    providers[provider] === true && (provider !== 'razorpay' || razorpayPrice(providers, tier, interval) !== undefined));
}
export function useBillingCatalog() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [providers, setProviders] = useState<BillingProviders>({ stripe: false, razorpay: false, paypal: false, providers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([
      ApiClient.request<BillingPlan[]>('/billing/plans', { signal: controller.signal }),
      ApiClient.request<BillingProviders>('/billing/providers', { signal: controller.signal }),
    ]).then(([catalog, capabilities]) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(catalog) || PLAN_ORDER.some(tier => !catalog.some(plan => plan.tier === tier && plan.limits && Number.isFinite(plan.priceMonthly) && Number.isFinite(plan.priceYearly)))) throw new Error('The plan catalog is incomplete. Please try again.');
      if (!capabilities || ['stripe', 'razorpay', 'paypal'].some(provider => typeof capabilities[provider] !== 'boolean')) throw new Error('Payment availability could not be loaded. Please try again.');
      setPlans([...catalog].sort((a, b) => PLAN_ORDER.indexOf(a.tier) - PLAN_ORDER.indexOf(b.tier)));
      setProviders(capabilities);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message || 'Pricing could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  return { plans, providers, loading, error, reload };
}
