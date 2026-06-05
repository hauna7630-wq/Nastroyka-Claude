// Stripe-backed PaymentProvider (production; compile-only — not exercised by tests).
//
// Wires Stripe Checkout for credit packs and verifies webhook signatures. The
// org id and credit count are carried in checkout metadata and read back on the
// `checkout.session.completed` event, whose id is the idempotency key.

import Stripe from 'stripe';
import { CheckoutSession, PaymentCompleted, PaymentProvider } from '../billing/payments';

export class StripePaymentProvider implements PaymentProvider {
  private readonly stripe: Stripe;

  constructor(
    private readonly opts: {
      apiKey: string;
      webhookSecret: string;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    this.stripe = new Stripe(opts.apiKey);
  }

  async createCheckout(args: {
    orgId: string;
    credits: number;
    amountCents: number;
  }): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: this.opts.successUrl,
      cancel_url: this.opts.cancelUrl,
      metadata: { orgId: args.orgId, credits: String(args.credits) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: args.amountCents,
            product_data: { name: `${args.credits} agent-os credits` },
          },
        },
      ],
    } as any);
    return { id: session.id, url: session.url ?? '' };
  }

  parseWebhook(rawBody: string, signature: string): PaymentCompleted | null {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.opts.webhookSecret,
    );
    if (event.type !== 'checkout.session.completed') return null;
    const obj = event.data.object as any;
    return {
      eventId: event.id,
      orgId: String(obj?.metadata?.orgId),
      credits: Number(obj?.metadata?.credits),
    };
  }
}
