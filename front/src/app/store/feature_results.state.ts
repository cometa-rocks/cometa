import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { FeatureResults } from './actions/feature_results.actions';

/**
 * @description Contains the state of all feature results
 * @author Alex Barba
 */
@State<IFeatureResultsState>({
  name: 'feature_results',
  defaults: {
    comment:
      'This state saves every feature result information when is needed, usually when viewing the result details.',
  },
})
@Injectable()
export class FeatureResultsState {
  constructor(private _api: ApiService) {}

  @Action(FeatureResults.GetFeatureResult)
  setAll(
    { setState, getState }: StateContext<IFeatureResultsState>,
    { resultId, useCache }: FeatureResults.GetFeatureResult
  ) {
    // Handle cached result
    if (useCache && getState()[resultId]) return;
    return this._api.getFeatureResult(resultId).pipe(
      tap(json => {
        setState(
          produce((ctx: IFeatureResultsState) => {
            ctx[resultId] = json;
          })
        );
      })
    );
  }

  @Action(FeatureResults.SetFeatureResult)
  getAll(
    { setState }: StateContext<IFeatureResultsState>,
    { resultId, info }: FeatureResults.SetFeatureResult
  ) {
    setState(
      produce((ctx: IFeatureResultsState) => {
        ctx[resultId] = info;
      })
    );
  }
}
