import { State, Action, StateContext, Selector } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { Browsers } from './actions/browsers.actions';
import { produce } from 'immer';

/**
 * @description Contains the state of all browsers
 * @author Alex Barba
 */
@State<BrowserResultObject[]>({
  name: 'browsers',
  defaults: []
})
@Injectable()
export class BrowsersState {

  constructor( private _api: ApiService ) { }

    @Action(Browsers.GetBrowsers)
    getBrowsers({ setState }: StateContext<BrowserResultObject[]>) {
        return this._api.getBrowsers().pipe(
            tap(browsers => setState(browsers))
        );
    }

    @Action(Browsers.SetBrowsers)
    setBrowsers({ setState }: StateContext<BrowserResultObject[]>, { browsers }: Browsers.SetBrowsers) {
        setState(browsers);
    }

    @Action(Browsers.UpdateBrowser)
    updateBrowser({ setState, getState }: StateContext<BrowserResultObject[]>, { browser }: Browsers.UpdateBrowser) {
        setState(
            produce(getState(), (ctx: BrowserResultObject[]) => {
                const index = ctx.findIndex(b => b.browser_id === browser.browser_id);
                if (index !== -1) {
                    ctx[index] = browser;
                }
            })
        )
    }

    @Action(Browsers.RemoveBrowser)
    removeBrowser({ setState, getState }: StateContext<BrowserResultObject[]>, { browser_id }: Browsers.RemoveBrowser) {
        setState(getState().filter(browser => browser.browser_id !== browser_id));
    }

    // Retrieve browsers JSONs information
    @Selector()
    @ImmutableSelector()
    static getBrowserJsons(state: BrowserResultObject[]) {
        return state.map(browser => browser.browser_json);
    }
}
