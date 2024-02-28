import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Browserstack } from './actions/browserstack.actions';

/**
 * @description Contains the state of all browsers in Browserstack
 * @author Alex Barba
 */
@State<BrowserstackBrowser[]>({
  name: 'browserstack_browsers',
  defaults: [],
})
@Injectable()
export class BrowserstackState {
  constructor(private _api: ApiService) {}

  @Action(Browserstack.GetBrowserstack)
  getBrowserstacks({ setState }: StateContext<BrowserstackBrowser[]>) {
    return this._api.getBrowserstackBrowsers().pipe(
      map(json => (json.success ? json.results : [])),
      tap(browsers => setState(browsers))
    );
  }

  @Action(Browserstack.SetBrowserstacks)
  setBrowserstacks(
    { setState }: StateContext<BrowserstackBrowser[]>,
    { browsers }: Browserstack.SetBrowserstacks
  ) {
    setState(browsers);
  }
}
