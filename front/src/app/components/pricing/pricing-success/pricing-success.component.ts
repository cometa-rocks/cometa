import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { SharedActionsService } from '@services/shared-actions.service';

@Component({
  selector: 'cometa-pricing-success',
  templateUrl: './pricing-success.component.html',
  styleUrls: ['./pricing-success.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PricingSuccessComponent {

  constructor(
    private _sharedActions: SharedActionsService,
    private _router: Router
  ) { }

  redirectAndOpenFeature() {
    this._router.navigate(['']);
    this._sharedActions.openEditFeature(null, 'new');
  }

}
