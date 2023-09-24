/**
 * Account Actions for accounts.state.ts
 * It is responsible for managing the Admin Accounts page
 */
export namespace Accounts {
  /**
   * @description Sets all the accounts in state
   * @param {IAccount[]} accounts Array of IAccount
   */
  export class SetAccounts {
    static readonly type = '[Accounts] Set Accounts';
    constructor(public accounts: IAccount[]) {}
  }

  /**
   * @description Makes request to get all the accounts available for the current user
   */
  export class GetAccounts {
    static readonly type = '[Accounts] Get All';
  }

  /**
   * @description Adds an account
   * @param {IAccount} account Account to add
   */
  export class AddAccount {
    static readonly type = '[Accounts] Add Account';
    constructor(public account: IAccount) {}
  }

  /**
   * @description Modify account
   * @param {IAccount} account Account to modify
   */
  export class ModifyAccount {
    static readonly type = '[Accounts] Modify Account';
    constructor(public account: IAccount) {}
  }

  /**
   * @description Remove an account
   * @param {number} account_id AccountID to remove
   */
  export class RemoveAccount {
    static readonly type = '[Accounts] Remove Account';
    constructor(public account_id: number) {}
  }
}
