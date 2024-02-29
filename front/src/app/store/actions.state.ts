import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Actions } from './actions/actions.actions';

/**
 * @description Contains the state of all actions
 * @author Alex Barba
 */
@State<Action[]>({
  name: 'actions',
  defaults: [],
})
@Injectable()
export class ActionsState {
  constructor(private _api: ApiService) {}

  @Action(Actions.GetActions)
  getActions({ setState }: StateContext<Action[]>) {
    return this._api
      .getAvailableActions()
      .pipe(tap(actions => setState(actions)));
  }

  @Action(Actions.SetActions)
  setActions(
    { setState }: StateContext<Action[]>,
    { actions }: Actions.SetActions
  ) {
    setState(actions);
  }
}
