import { describe, expect, it } from 'vitest';
import {
  availableProviders, formatMoney, razorpayPrice, selectCurrentSubscription,
  type BillingHistory, type BillingProviders, type BillingSubscription,
} from '../billing';

const providers: BillingProviders = {
  stripe: false,
  razorpay: true,
  paypal: false,
  providers: ['razorpay'],
  razorpayPrices: { PRO_MONTHLY: 9900 },
};

// These are isolated subscription records for display selection, with no
// payment identifiers, signatures, checkout responses, or activation behavior.
const now = Date.parse('2026-11-08T06:30:00Z');
function subscription(overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    id: 'display-subscription-fixture',
    plan: 'PRO',
    provider: 'razorpay',
    status: 'ACTIVE',
    interval: 'monthly',
    currentPeriodStart: '2026-11-01T00:00:00Z',
    currentPeriodEnd: '2026-12-01T00:00:00Z',
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}
function history(subscriptions: BillingSubscription[], overrides: Partial<BillingHistory> = {}): BillingHistory {
  return {
    currentPlan: 'PRO', subscription: null, subscriptions, payments: [], invoices: [], ...overrides,
  };
}

describe('billing amount presentation', () => {
  it('retains the full yearly catalog total and fractional amounts', () => {
    expect(formatMoney(120)).toBe('$120');
    expect(formatMoney(40.83)).toBe('$40.83');
  });

  it('formats INR only after explicitly converting configured paise to rupees', () => {
    const paise = razorpayPrice(providers, 'PRO', 'monthly');
    expect(paise).toBe(9900);
    expect(formatMoney(paise! / 100, 'INR')).toBe('₹99');
    expect(formatMoney(12, 'USD')).toBe('$12');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('shows unavailable instead of a non-finite price: %s', amount => {
    expect(formatMoney(amount)).toBe('Unavailable');
  });
});

describe('configured payment availability', () => {
  it('does not borrow the monthly INR price for an unconfigured yearly interval', () => {
    expect(razorpayPrice(providers, 'PRO', 'yearly')).toBeUndefined();
    expect(availableProviders(providers, 'PRO', 'yearly')).toEqual([]);
  });

  it('does not borrow a configured price from a different plan or synthesize an INR price', () => {
    expect(razorpayPrice(providers, 'BUSINESS', 'monthly')).toBeUndefined();
    expect(availableProviders(providers, 'BUSINESS', 'monthly')).toEqual([]);
    expect(razorpayPrice({ ...providers, razorpayPrices: {} }, 'PRO', 'monthly')).toBeUndefined();
  });

  it('keeps configured prices unavailable when the provider is disabled', () => {
    expect(availableProviders({ ...providers, razorpay: false, providers: [] }, 'PRO', 'monthly')).toEqual([]);
  });

  it('keeps enabled USD providers usable when an INR interval is unconfigured', () => {
    expect(availableProviders({ ...providers, stripe: true, paypal: true, providers: ['stripe', 'razorpay', 'paypal'] }, 'PRO', 'yearly')).toEqual(['stripe', 'paypal']);
  });

  it.each([0, -9900, 99.5, Number.MAX_SAFE_INTEGER + 1])('does not offer invalid paise configuration: %s', paise => {
    const invalid = { ...providers, razorpayPrices: { PRO_MONTHLY: paise } };
    expect(razorpayPrice(invalid, 'PRO', 'monthly')).toBeUndefined();
    expect(availableProviders(invalid, 'PRO', 'monthly')).toEqual([]);
  });
});

describe('current subscription presentation', () => {
  it('matches the authoritative currentPlan instead of the first ACTIVE record or history shortcut', () => {
    const differentTier = subscription({ id: 'other-display-fixture', plan: 'BUSINESS' });
    const current = subscription();
    expect(selectCurrentSubscription(history([differentTier, current], { subscription: differentTier }), now)).toBe(current);
  });

  it('requires the paid period to have started and not yet ended', () => {
    const expired = subscription({ currentPeriodEnd: new Date(now).toISOString() });
    const future = subscription({ currentPeriodStart: new Date(now + 1).toISOString() });
    const current = subscription({ currentPeriodStart: new Date(now).toISOString() });
    expect(selectCurrentSubscription(history([expired, future, current]), now)).toBe(current);
    expect(selectCurrentSubscription(history([expired, future]), now)).toBeNull();
  });

  it('accepts a current trial or cancellation scheduled at period end without inventing renewal', () => {
    const trial = subscription({ status: 'TRIALING' });
    const scheduled = subscription({ cancelAtPeriodEnd: true });
    expect(selectCurrentSubscription(history([trial]), now)).toBe(trial);
    expect(selectCurrentSubscription(history([scheduled]), now)).toBe(scheduled);
  });

  it('does not display canceled, unpaid, past-due, or malformed-date records as current', () => {
    const records = ['CANCELED', 'UNPAID', 'PAST_DUE', 'INCOMPLETE'].map(status => subscription({ status }));
    records.push(subscription({ currentPeriodEnd: 'unparseable' }));
    expect(selectCurrentSubscription(history(records), now)).toBeNull();
  });

  it('does not select an old paid subscription when the server reports FREE or no matching paid period', () => {
    expect(selectCurrentSubscription(history([subscription()], { currentPlan: 'FREE' }), now)).toBeNull();
    expect(selectCurrentSubscription(history([], { currentPlan: 'ENTERPRISE' }), now)).toBeNull();
  });
});
