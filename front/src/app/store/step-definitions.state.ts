import { State, Action, StateContext, Selector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { StepDefinitions } from './actions/step_definitions.actions';

/**
 * @description Contains the state of all steps definitions, used for EditFeature component
 * @author Alex Barba
 */
@State<IStepDefinitionsState>({
  name: 'steps_defnitions',
  defaults: {
    comment:
      'This state saves the steps defined for each feature, including the new and cloned features.',
  },
})
@Injectable()
export class StepDefinitionsState {
  constructor(private _api: ApiService) {}

  @Action(StepDefinitions.SetStepsForFeature)
  setAll(
    { setState }: StateContext<IStepDefinitionsState>,
    { featureId, steps }: StepDefinitions.SetStepsForFeature
  ) {
    setState(
      produce((ctx: IStepDefinitionsState) => {
        ctx[featureId] = steps;
      })
    );
  }

  @Action(StepDefinitions.GetStepsForFeature)
  getAll(
    { setState }: StateContext<IStepDefinitionsState>,
    { featureId }: StepDefinitions.GetStepsForFeature
  ) {
    return this._api.getFeatureSteps(featureId).pipe(
      tap(steps => {
        setState(
          produce((ctx: IStepDefinitionsState) => {
            ctx[featureId] = steps;
          })
        );
      })
    );
  }

  @Action(StepDefinitions.ClearNewFeature)
  clearNewFeature({ setState }: StateContext<IStepDefinitionsState>) {
    setState(
      produce((ctx: IStepDefinitionsState) => {
        delete ctx[0];
      })
    );
  }

  @Selector()
  @ImmutableSelector()
  static GetFeatureSteps(state: IStepDefinitionsState) {
    return (featureId: number) => state[featureId] || [];
  }
}
