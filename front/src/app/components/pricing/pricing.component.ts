import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { PaymentsService } from '@services/payments.service';
import { Subscriptions } from '@store/subscriptions.state';
import { filter, switchMap } from 'rxjs/operators';
import { NgFor, NgIf, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'cometa-pricing',
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgFor, NgIf, TitleCasePipe],
})
export class PricingComponent implements OnInit {
  @ViewSelectSnapshot(CustomSelectors.SubscriptionsByCloud()) clouds: [
    string,
    Subscription[],
  ][];

  constructor(
    private _payments: PaymentsService,
    private _store: Store
  ) {}

  purchaseSubscription(sub_id: number) {
    this._payments
      .createPaymentSubscription(sub_id)
      .pipe(
        filter(json => !!json.success),
        switchMap(json => this._payments.redirectToCheckout(json.sessionId))
      )
      .subscribe((result: any) => {
        if (result.error) {
          console.log(result.error.message);
        }
      });
  }

  ngOnInit() {
    this._store.dispatch(new Subscriptions.GetAll());
  }
}
