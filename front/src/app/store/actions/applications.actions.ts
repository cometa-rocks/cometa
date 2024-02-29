/**
 * Application Actions for applications.state.ts
 */
export namespace Applications {
  /**
   * @description Sets the applications array
   * @param {Application[]} apps Array of applications
   */
  export class SetApplications {
    static readonly type = '[Applications] Set Applications';
    constructor(public apps: Application[]) {}
  }

  /**
   * @description Makes a request to get all the applications for the current user
   */
  export class GetApplications {
    static readonly type = '[Applications] Get All';
  }

  /**
   * @description Adds an application
   * @param {Application} app Application object
   */
  export class AddApplication {
    static readonly type = '[Applications] Add Application';
    constructor(public app: Application) {}
  }

  /**
   * @description Updates one application
   * @param {Application} app Application object
   */
  export class UpdateApplication {
    static readonly type = '[Applications] Update';
    constructor(public app: Application) {}
  }

  /**
   * @description Remove an application
   * @param {number} app_id ApplicationID
   */
  export class RemoveApplication {
    static readonly type = '[Applications] Remove Application';
    constructor(public app_id: number) {}
  }
}
