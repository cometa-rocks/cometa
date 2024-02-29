import { State, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { produce } from 'immer';

export namespace LoadingActions {
  export class SetLoading {
    static readonly type = '[Loading] Set';
    constructor(
      public readonly id: string | number,
      public readonly loading: boolean
    ) {}
  }
}

/**
 * @description Contains the state of all actions
 * @author Alex Barba
 */
@State<ILoadingsState>({
  name: 'loadings',
  defaults: {
    // @ts-ignore
    comment:
      'This state allows to communicate and set loading statuses between components/services without any connection.',
  },
})
@Injectable()
export class LoadingsState {
  @Action(LoadingActions.SetLoading)
  getLogs(
    { setState }: StateContext<ILoadingsState>,
    { id, loading }: LoadingActions.SetLoading
  ) {
    setState(
      produce((ctx: ILoadingsState) => {
        ctx[id] = loading;
      })
    );
  }
}
