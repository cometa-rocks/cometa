import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { PaymentsService } from '@services/payments.service';
import { tap } from 'rxjs/operators';

export namespace Subscriptions {
  /**
   * @description Get all subscriptions from backend
   */
  export class GetAll {
    static readonly type = '[Subscriptions] Get';
  }
}

/**
 * @description Contains the state of all subscriptions
 * @author Alex Barba
 */
@State<Subscription[]>({
  name: 'subscriptions',
  defaults: [],
})
@Injectable()
export class SubscriptionsState {
  constructor(private _payments: PaymentsService) {}

  @Action(Subscriptions.GetAll)
  getAll({ setState }: StateContext<Subscription[]>) {
    return this._payments.getSubscriptions().pipe(tap(subs => setState(subs)));
  }
}
