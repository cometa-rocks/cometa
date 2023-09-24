import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { Environments } from './actions/environments.actions';

/**
 * @description Contains the state of all environments
 * @author Alex Barba
 */
@State<Environment[]>({
  name: 'environments',
  defaults: [],
})
@Injectable()
export class EnvironmentsState {
  constructor(private _api: ApiService) {}

  @Action(Environments.GetEnvironments)
  getEnvironments({ setState }: StateContext<Environment[]>) {
    return this._api.getEnvironments().pipe(
      map(json => json.results),
      tap(environments => setState(environments))
    );
  }

  @Action(Environments.AddEnvironment)
  addEnvironment(
    { setState, getState }: StateContext<Environment[]>,
    { env }: Environments.AddEnvironment
  ) {
    // Add department only if doesn't exist already
    if (!getState().some(en => en.environment_id === env.environment_id)) {
      // Add application
      setState([...getState(), env]);
    }
  }

  @Action(Environments.SetEnvironments)
  setEnvironments(
    { setState }: StateContext<Environment[]>,
    { environments }: Environments.SetEnvironments
  ) {
    setState(environments);
  }

  @Action(Environments.UpdateEnvironment)
  updateEnvironment(
    { setState, getState }: StateContext<Environment[]>,
    { environment }: Environments.UpdateEnvironment
  ) {
    setState(
      produce(getState(), (ctx: Environment[]) => {
        const index = ctx.findIndex(
          env => env.environment_id === environment.environment_id
        );
        ctx[index] = environment;
      })
    );
  }

  @Action(Environments.RemoveEnvironment)
  removeEnvironment(
    { setState, getState }: StateContext<Environment[]>,
    { environment_id }: Environments.RemoveEnvironment
  ) {
    const environments = getState();
    const index = environments.findIndex(
      env => env.environment_id === environment_id
    );
    environments.splice(index, 1);
    setState(environments);
  }
}
