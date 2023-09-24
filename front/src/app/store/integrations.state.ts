import { State, Action, StateContext, Selector } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Integrations } from './actions/integrations.actions';
import { produce } from 'immer';

/**
 * @description Contains the state of all actions
 * @author Alex Barba
 */
@State<Integration[]>({
  name: 'integrations',
  defaults: [],
})
@Injectable()
export class IntegrationsState {
  constructor(private _api: ApiService) {}

  @Action(Integrations.Get)
  getIntegrations({ setState }: StateContext<Integration[]>) {
    return this._api.getIntegrations().pipe(tap(ints => setState(ints)));
  }

  @Action(Integrations.Set)
  setIntegrations(
    { setState }: StateContext<Integration[]>,
    { integrations }: Integrations.Set
  ) {
    setState(integrations);
  }

  @Action(Integrations.AddOne)
  addIntegration(
    { setState, getState }: StateContext<Integration[]>,
    { integration }: Integrations.AddOne
  ) {
    setState(
      produce(getState(), (ctx: Integration[]) => {
        // Add only if it doesn't exist yet
        const int = ctx.find(int => int.id === integration.id);
        if (!int) {
          ctx.push(integration);
        }
      })
    );
  }

  @Action(Integrations.PatchOne)
  patchIntegration(
    { setState, getState }: StateContext<Integration[]>,
    { integration }: Integrations.PatchOne
  ) {
    setState(
      produce(getState(), (ctx: Integration[]) => {
        // Patch only if it exists in state
        const index = ctx.findIndex(int => int.id === integration.id);
        if (index >= 0) {
          ctx[index] = integration;
        }
      })
    );
  }

  @Action(Integrations.RemoveOne)
  removeIntegration(
    { setState, getState }: StateContext<Integration[]>,
    { integrationId }: Integrations.RemoveOne
  ) {
    setState(
      produce(getState(), (ctx: Integration[]) =>
        ctx.filter(int => int.id !== integrationId)
      )
    );
  }

  @Selector()
  static ByDepartment(ctx: Integration[]) {
    return ctx.reduce((r, a) => {
      const name = a.department.department_name;
      r[name] = r[name] || [];
      r[name].push(a);
      return r;
    }, {});
  }
}
