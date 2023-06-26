import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_LEGACY_SNACK_BAR_DATA as MAT_SNACK_BAR_DATA } from '@angular/material/legacy-snack-bar';

/**
 * Snack used to show a loading state
 * Usage: this._snack.openFromComponent(LoadingSnack, { data: 'Loading...' })
 * NOTES:
 *  - You can also get the reference of the dialog to later close this snack:
 *    const snackRef = this._snack.openFromComponent(LoadingSnack, { data: 'Loading...' });
 *    snackRef.dismiss();
 */
@Component({
  selector: 'loading-snack',
  templateUrl: 'loading.snack.html',
  styleUrls: ['loading.snack.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSnack {
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public text: string
  ) { }
}