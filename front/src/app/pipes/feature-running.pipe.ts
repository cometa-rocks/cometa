/**
 * feature-running.pipe.ts
 *
 * Pipe used to see if a feature is running or not
 *
 * @author dph000
 */
import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Observable } from 'rxjs';

@Pipe({
  name: 'featureRunning',
  standalone: true,
})
export class FeatureRunningPipe implements PipeTransform {
  constructor(private _store: Store) {}

  // Returns the status of the selected feature and show if it is running
  transform(featureId: number): Observable<boolean> {
    return this._store.select(
      CustomSelectors.GetFeatureRunningStatus(featureId)
    );
  }
}
