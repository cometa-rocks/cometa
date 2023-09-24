import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Applications } from './actions/applications.actions';
import produce from 'immer';

/**
 * @description Contains the state of all applications
 * @author Alex Barba
 */
@State<Application[]>({
  name: 'applications',
  defaults: [],
})
@Injectable()
export class ApplicationsState {
  constructor(private _api: ApiService) {}

  @Action(Applications.GetApplications)
  getApplications({ setState }: StateContext<Application[]>) {
    return this._api.getApplications().pipe(
      map(json => json.results),
      tap(apps => setState(apps))
    );
  }

  @Action(Applications.AddApplication)
  addApplication(
    { setState, getState }: StateContext<Application[]>,
    { app }: Applications.AddApplication
  ) {
    // Add department only if doesn't exist already
    if (!getState().some(ap => ap.app_id === app.app_id)) {
      // Add application
      setState([...getState(), app]);
    }
  }

  @Action(Applications.SetApplications)
  setApplications(
    { setState }: StateContext<Application[]>,
    { apps }: Applications.SetApplications
  ) {
    setState(apps);
  }

  @Action(Applications.UpdateApplication)
  updateApplication(
    { setState, getState }: StateContext<Application[]>,
    { app }: Applications.UpdateApplication
  ) {
    setState(
      produce(getState(), (ctx: Application[]) => {
        const index = ctx.findIndex(a => a.app_id === app.app_id);
        if (index !== -1) {
          ctx[index] = app;
        }
      })
    );
  }

  @Action(Applications.RemoveApplication)
  removeApplication(
    { setState, getState }: StateContext<Application[]>,
    { app_id }: Applications.RemoveApplication
  ) {
    const apps = getState();
    const index = apps.findIndex(app => app.app_id === app_id);
    apps.splice(index, 1);
    setState(apps);
  }
}
