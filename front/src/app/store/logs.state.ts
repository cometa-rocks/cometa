import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { produce } from 'immer';
import { Logs } from './actions/logs.actions';

/**
 * @description Contains the state of all actions
 * @author Alex Barba
 */
@State<ILogsState>({
  name: 'logs',
  defaults: {
    comment:
      'This states saves the log output of each feature result as requested.',
  },
})
@Injectable()
export class LogsState {
  constructor(private _api: ApiService) {}

  @Action(Logs.GetLogs)
  getLogs(
    { setState }: StateContext<ILogsState>,
    { featureResultId }: Logs.GetLogs
  ) {
    return this._api.getLogOutput(featureResultId).pipe(
      tap(json => {
        setState(
          produce((ctx: ILogsState) => {
            ctx[featureResultId] = json;
          })
        );
      })
    );
  }
}
