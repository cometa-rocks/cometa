import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Lyrid } from './actions/browserslyrid.actions';

/**
 * @description Contains the state of all browsers in Lyrid
 * @author Arslan Sohail Bano
 */
@State<BrowserstackBrowser[]>({
  name: 'lyrid_browsers',
  defaults: []
})
@Injectable()
export class LyridBrowsersState {

  constructor( private _api: ApiService ) { }

    @Action(Lyrid.GetLyridBrowsers)
    getLyridBrowsers({ setState }: StateContext<BrowserstackBrowser[]>) {
        return this._api.getLyridBrowsers().pipe(
            map(json => json.success ? json.results : []),
            tap(browsers => setState(browsers))
        );
    }

    @Action(Lyrid.SetLyridBrowsers)
    setLyridBrowsers({ setState }: StateContext<BrowserstackBrowser[]>, { browsers }: Lyrid.SetLyridBrowsers) {
        setState(browsers);
    }

}
