import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { StepResults } from './actions/step_results.actions';

/**
 * @description Contains the state of all steps results
 * THIS STATE IS NOT USED
 * @author Alex Barba
 */
@State<IStepResultsState>({
  name: 'step_results',
  defaults: {},
})
@Injectable()
export class StepResultsState {
  constructor(private _api: ApiService) {}

  @Action(StepResults.GetStepResults)
  setAll(
    { setState }: StateContext<IStepResultsState>,
    { featureId, resultId, page }: StepResults.GetStepResults
  ) {
    return this._api.getSteps(featureId, resultId, page).pipe(
      tap(json => {
        setState(
          produce((ctx: IStepResultsState) => {
            ctx[resultId] = ctx[resultId] || {};
            ctx[resultId][page] = json;
          })
        );
      })
    );
  }
}
