import { Pipe, PipeTransform } from '@angular/core';
import { Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { Observable } from 'rxjs';

@Pipe({
    name: 'fillFeatureInfo',
    standalone: true
})
export class FillFeatureInfoPipe implements PipeTransform {

  constructor(
    private _store: Store
  ) { }

  /**
   * Converts a given array of featureIds
   * to an array of useful feature observables
   * in template
   */
  transform(featureIds: number[]): FeatureFilledInfo[] {
    return [ ...featureIds ].map(id => ({
      id: id,
      info: this._store.select(CustomSelectors.GetFeatureInfo(id)),
      running: this._store.select(CustomSelectors.GetFeatureRunningStatus(id)),
      status: this._store.select(CustomSelectors.GetFeatureStatus(id))
    }))
  }

}

export interface FeatureFilledInfo {
  id: number;
  info: Observable<Feature>;
  running: Observable<boolean>;
  status: Observable<string>;
}