/**
 * Actions for actions.state.ts
 */
export namespace Actions {
  /**
   * @description Sets the actions
   * @param {Action[]} actions Array of actions
   */
  export class SetActions {
    static readonly type = '[Actions] Set Actions';
    constructor(public actions: Action[]) {}
  }

  /**
   * @description Makes a request to get all the actions
   */
  export class GetActions {
    static readonly type = '[Actions] Get All';
  }
}
