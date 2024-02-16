import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL, API_BASE, STRIPE_API_KEY } from 'app/tokens';
import { map } from 'rxjs/operators';
import { from } from 'rxjs';

declare const Stripe: any;

@Injectable()
export class PaymentsService {
  stripe: any;

  constructor(
    private _http: HttpClient,
    @Inject(API_URL) public api: string,
    @Inject(API_BASE) public base: string,
    @Inject(STRIPE_API_KEY) public stripe_key: string
  ) {
    this.stripe = Stripe(this.stripe_key);
  }

  getSubscriptions() {
    return this._http
      .get<PaginatedResponse<Subscription>>(`${this.api}subscriptions/`)
      .pipe(map(json => json.results));
  }

  // Create payment request on backend for sessionId retrieving
  createPaymentSubscription(subscriptionId: number) {
    return this._http.post<Success>(`${this.base}createPayment/`, {
      subscription: subscriptionId,
      type: 'Subscription',
    });
  }

  redirectToCheckout(sessionId: string) {
    return from(
      this.stripe.redirectToCheckout({
        sessionId: sessionId,
      })
    );
  }
}
