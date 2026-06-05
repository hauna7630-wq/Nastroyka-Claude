// Payment provider port + adapters (F4, Stripe).
//
// The Control Plane creates a checkout for a credit pack; on the resulting
// webhook it grants credits idempotently (keyed on the provider event id).

export interface CheckoutSession {
  id: string;
  url: string;
}

// Normalised view of a "payment completed" event, provider-agnostic.
export interface PaymentCompleted {
  eventId: string; // idempotency key
  orgId: string;
  credits: number;
}

export interface PaymentProvider {
  createCheckout(args: {
    orgId: string;
    credits: number;
    amountCents: number;
  }): Promise<CheckoutSession>;

  /**
   * Verify + parse a webhook into a PaymentCompleted, or null if the event is
   * not a completed payment we care about.
   */
  parseWebhook(rawBody: string, signature: string): PaymentCompleted | null;
}

// Deterministic provider for tests/dev. The webhook body is plain JSON.
export class MockPaymentProvider implements PaymentProvider {
  async createCheckout(args: {
    orgId: string;
    credits: number;
    amountCents: number;
  }): Promise<CheckoutSession> {
    const id = `cs_test_${args.orgId}_${args.credits}`;
    return { id, url: `https://pay.example.com/${id}` };
  }

  parseWebhook(rawBody: string): PaymentCompleted | null {
    const evt = JSON.parse(rawBody);
    if (evt?.type !== 'checkout.session.completed') return null;
    return {
      eventId: String(evt.id),
      orgId: String(evt.data?.object?.metadata?.orgId),
      credits: Number(evt.data?.object?.metadata?.credits),
    };
  }
}
