import { Tour, TourExtended } from '@services/tours';

/**
 * User Actions for user.state.ts
 */
export namespace User {
  /**
   * @description Allows to change the favourite browsers array of the current user
   * @param {BrowserstackBrowser[]} browsers Array of browsers
   */
  export class SetBrowserFavourites {
    static readonly type = '[User] Set Browsers';
    constructor(public browsers: BrowserstackBrowser[]) {}
  }

  /**
   * @description Allows to add a favourite browser to the current user
   * @param {BrowserstackBrowser} browser Browser object
   */
  export class AddBrowserFavourite {
    static readonly type = '[User] Add Browser';
    constructor(public browser: BrowserstackBrowser) {}
  }

  /**
   * @description Allows to remove a favourite browser to the current user
   * @param {BrowserstackBrowser} browser Browser object
   */
  export class RemoveBrowserFavourite {
    static readonly type = '[User] Remove Browser';
    constructor(public browser: BrowserstackBrowser) {}
  }

  /**
   * @description Makes a request to get the User Info
   */
  export class GetUser {
    static readonly type = '[User] Get UserInfo';
  }

  /**
   * @description Sets the User Info
   * @param {UserInfo} user User Info object
   */
  export class SetUser {
    static readonly type = '[User] Set UserInfo';
    constructor(public user: UserInfo) {}
  }

  /**
   * @description Logouts the current user
   */
  export class Logout {
    static readonly type = '[User] Logout';
  }

  /**
   * @description Marks a tour as completed without making request
   */
  export class MarkTourCompleted {
    static readonly type = '[User] Mark tour completed';
    constructor(public readonly tour: Tour | TourExtended) {}
  }

  /**
   * @description Changes a setting option of current user
   * @param {string} setting Setting options to modify
   * @param {any} value Setting value to modify
   */
  export class SetSetting {
    static readonly type = '[User] Set Setting';
    constructor(public settings: SetSettingOptions) {}
  }
}
