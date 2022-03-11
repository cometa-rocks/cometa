import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import { User } from './actions/user.actions';
import produce from 'immer';
import { Browserstack } from './actions/browserstack.actions';
import { Browsers } from './actions/browsers.actions';

/**
 * @description Contains the state of the Configuration
 * @author Alex Barba
 */
@State<UserInfo>({
  name: 'user',
  defaults: {
    comment: 'This state handles all the user information, including settings, clouds, permissions, etc'
  }
})
@Injectable()
export class UserState {

  constructor(
    private _api: ApiService
  ) { }

  @Action(User.GetUser)
  getUser({ patchState, dispatch }: StateContext<UserInfo>) {
    return this._api.doOIDCLogin().pipe(
      tap(account => {

        // set up localstorage instance for each existing property in account settings object
        // does the same as below commented >>>> localstorage.setItem
        Object.keys(account.settings).forEach(key => {
          localStorage.setItem(key, account.settings[key]);
        });


        // localStorage.setItem('useNewDashboard', account.settings?.useNewDashboard);
        // localStorage.setItem('logWebsockets', account.settings?.logWebsockets);
        // localStorage.setItem('percentMode', account.settings?.percentMode);
        // localStorage.setItem('da', account.settings?.disableAnimations);
        // localStorage.setItem('hideInformation', account.settings?.hideInformation);
        // localStorage.setItem('hideSendMail', account.settings?.hideSendMail);
        // localStorage.setItem('hideBrowsers', account.settings?.hideBrowsers);
        // localStorage.setItem('hideSteps', account.settings?.hideSteps);
        // localStorage.setItem('hideSchedule', account.settings?.hideSchedule);

        if (typeof account.favourite_browsers === 'object') account.favourite_browsers = JSON.stringify(account.favourite_browsers);
        // Cross-join available clouds with subscriptions
        if (account.requires_payment) {
          account.clouds = account.clouds.filter(cloud => {
            return account.subscriptions.some(sub => sub.cloud.toLowerCase() === cloud.name.toLowerCase())
          })
        }
        if (account.feedback_mail) {
          localStorage.setItem('feedback_mail', account.feedback_mail);
        }
        // Request browser items for each available clouds
        for (const cloud of account.clouds) {
          switch (cloud.name) {
            case 'local':
              dispatch(new Browsers.GetBrowsers);
              break;
            case 'browserstack':
              dispatch(new Browserstack.GetBrowserstack);
              break;
          }
        }
        patchState(account);
      })
    )
  }

  @Action(User.SetUser)
  setUser({ setState }: StateContext<UserInfo>, { user }: User.SetUser) {
    setState(user);
  }

  @Action(User.Logout)
  userLogout() {
    // Do nothing with the state, just redirect to logout.html
    localStorage.removeItem('@@STATE');
    window.location.href = '/callback?logout=/logout.html';
  }

  @Action(User.SetBrowserFavourites)
  setBrowsers({ patchState, getState }: StateContext<UserInfo>, { browsers }: User.SetBrowserFavourites) {
    patchState({
      favourite_browsers: JSON.stringify(browsers)
    });
    return this._api.saveBrowserFavourites(getState(), browsers);
  }

  @Action(User.AddBrowserFavourite)
  addBrowser({ patchState, getState }: StateContext<UserInfo>, { browser }: User.AddBrowserFavourite) {
    const currentBrowsers = JSON.parse(getState().favourite_browsers);
    currentBrowsers.push(browser);
    patchState({
      favourite_browsers: JSON.stringify(currentBrowsers)
    });
    return this._api.saveBrowserFavourites(getState(), currentBrowsers);
  }

  @Action(User.RemoveBrowserFavourite)
  removeBrowser({ patchState, getState }: StateContext<UserInfo>, { browser }: User.RemoveBrowserFavourite) {
    let currentBrowsers = JSON.parse(getState().favourite_browsers) as BrowserstackBrowser[];
    currentBrowsers = currentBrowsers.filter(brow => !(brow.browser === browser.browser &&
      brow.os === browser.os &&
      brow.os_version === browser.os_version &&
      brow.browser_version === browser.browser_version &&
      brow.device === browser.device &&
      brow.real_mobile === browser.real_mobile));
    patchState({
      favourite_browsers: JSON.stringify(currentBrowsers)
    });
    return this._api.saveBrowserFavourites(getState(), currentBrowsers);
  }

  @Action(User.SetSetting)
  setSetting({ patchState, getState }: StateContext<UserInfo>, { settings }: User.SetSetting) {
    const user = getState();
    const new_settings = {
      ...user.settings,
      ...settings
    };
    return this._api.saveUserSettings(user, new_settings).pipe(
      tap(_ => patchState({ settings: new_settings }))
    )
  }

  @Action(User.MarkTourCompleted)
  completedTour({ setState }: StateContext<UserInfo>, { tour }: User.MarkTourCompleted) {
    setState(
      produce((ctx: UserInfo) => {
        ctx.settings.tours_completed = ctx.settings.tours_completed || {};
        ctx.settings.tours_completed[tour.id] = tour.version;
      })
    )
  }

  @Selector()
  static GetSubscriptions(state: UserInfo) {
    return state.subscriptions;
  }

  @Selector()
  static GetRequiresPayment(state: UserInfo) {
    return !!state.requires_payment;
  }

  @Selector()
  static HasOneActiveSubscription(state: UserInfo) {
    return state?.requires_payment ? state?.subscriptions.length > 0 : true;
  }

  @Selector()
  @ImmutableSelector()
  static GetAvailableClouds(state: UserInfo) {
    return state.clouds.filter(cloud => !!cloud.active)
  }

  @Selector()
  @ImmutableSelector()
  static GetPermissionTypes(state: UserInfo) {
    return state.permissions;
  }

  static GetPermission(permission_name: string) {
    return createSelector([UserState], (user: UserInfo) => {
      return user && user.user_permissions[permission_name] || false;
    });
  }

  @Selector()
  @ImmutableSelector()
  static GetUserId(user: UserInfo): number {
    return user.user_id;
  }

  /**
   * Returns the username of the currently logged user
   * @param user
   * @author dph000
   * @date 21/10/29
   * @lastModification 21/10/29
   */
  @Selector()
  @ImmutableSelector()
  static GetUserName(user: UserInfo): string {
    return user.name;
  }

  @Selector()
  @ImmutableSelector()
  static GetBrowserFavourites(user: UserInfo): BrowserstackBrowser[] {
    try {
      const browsers: BrowserstackBrowser[] = JSON.parse(user.favourite_browsers);
      browsers.forEach((browser, index) => {
        if (typeof browser !== 'object') browsers.splice(index, 1);
      });
      return browsers;
    } catch (err) {
      return [];
    }
  }

  @Selector()
  @ImmutableSelector()
  static RetrieveUserDepartments(user: UserInfo): Department[] {
    return user.departments;
  }

  @Selector()
  @ImmutableSelector()
  static IsDefaultDepartment(user: UserInfo): boolean {
    return user.departments.length === 1 && user.departments[0].department_name === 'Default';
  }

  @Selector()
  @ImmutableSelector()
  static RetrieveSettings(user: UserInfo): any {
    return user.settings;
  }

  @Selector()
  @ImmutableSelector()
  static RetrieveEncryptionPrefix(user: UserInfo): string {
    return user.encryption_prefix;
  }

  @Selector()
  @ImmutableSelector()
  static RetrieveIntegrationApps(user: UserInfo) {
    return user.integration_apps;
  }

}
