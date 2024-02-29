import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import produce from 'immer';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Screenshots } from './actions/screenshots.actions';

/**
 * @description Contains the state of all steps results
 * THIS STATE IS NOT USED
 * @author Alex Barba
 */
@State<IScreenshotsState>({
  name: 'screenshots',
  defaults: {},
})
@Injectable()
export class ScreenshotsState {
  constructor(private _api: ApiService) {}

  @Action(Screenshots.GetScreenshots)
  setAll(
    { setState }: StateContext<IScreenshotsState>,
    { stepResultId }: Screenshots.GetScreenshots
  ) {
    return this._api.getScreenshots(stepResultId).pipe(
      tap(json => {
        setState(
          produce((ctx: IScreenshotsState) => {
            // @ts-ignore
            ctx[stepResultId] = json.screenshots;
          })
        );
      })
    );
  }

  @Action(Screenshots.SetScreenshots)
  getAll(
    { setState }: StateContext<IScreenshotsState>,
    { stepResultId, screenshots }: Screenshots.SetScreenshots
  ) {
    setState(
      produce((ctx: IScreenshotsState) => {
        ctx[stepResultId] = screenshots;
      })
    );
  }

  @Action(Screenshots.RemoveScreenshot)
  remove(
    { setState }: StateContext<IScreenshotsState>,
    { stepResultId, index }: Screenshots.RemoveScreenshot
  ) {
    setState(
      produce((ctx: IScreenshotsState) => {
        ctx[stepResultId][index] = 'removed';
      })
    );
  }
}
