import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { parse } from 'date-fns';
import { produce } from 'immer';
import { Accounts } from './actions/accounts.actions';

/**
 * @description Contains the state of all admin accounts
 * @author Alex Barba
 */
@State<IAccount[]>({
  name: 'accounts',
  defaults: [],
})
@Injectable()
export class AccountsState {
  constructor(private _api: ApiService) {}

  @Action(Accounts.GetAccounts)
  getAccounts({ setState }: StateContext<IAccount[]>) {
    return this._api.getAccounts().pipe(
      tap(accounts => {
        accounts.sort(
          (a, b) =>
            parse(a.created_on, "yyyy-MM-dd'T'HH:mm:ss", new Date()).valueOf() -
            parse(b.created_on, "yyyy-MM-dd'T'HH:mm:ss", new Date()).valueOf()
        );
        setState(accounts);
      })
    );
  }

  @Action(Accounts.AddAccount)
  addAccount(
    { setState, getState }: StateContext<IAccount[]>,
    { account }: Accounts.AddAccount
  ) {
    setState([...getState(), account]);
  }

  @Action(Accounts.SetAccounts)
  setAccounts(
    { setState }: StateContext<IAccount[]>,
    { accounts }: Accounts.SetAccounts
  ) {
    setState(accounts);
  }

  @Action(Accounts.ModifyAccount)
  modifyAccount(
    { setState, getState }: StateContext<IAccount[]>,
    { account }: Accounts.ModifyAccount
  ) {
    setState(
      produce(getState(), ctx => {
        const index = ctx.findIndex(acc => acc.user_id === account.user_id);
        ctx[index] = { ...account };
      })
    );
  }

  @Action(Accounts.RemoveAccount)
  removeAccount(
    { setState, getState }: StateContext<IAccount[]>,
    { account_id }: Accounts.RemoveAccount
  ) {
    let accs = getState();
    accs = accs.filter(acc => acc.user_id !== account_id);
    setState(accs);
  }
}
