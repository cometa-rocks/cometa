import { State, Action, StateContext, Selector } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { ImmutableSelector } from '@ngxs-labs/immer-adapter';
import produce from 'immer';
import { Variables } from './actions/variables.actions';
import { sortBy } from 'ngx-amvara-toolbox';

/**
 * @description Contains the state of all variables
 * @author Alex Barba
 */
@State<VariablePair[]>({
  name: 'variables',
  defaults: []
})
@Injectable()
export class VariablesState {

  constructor( private _api: ApiService ) { }

  @Action(Variables.GetVariables)
  getAll({ setState }: StateContext<VariablePair[]>) {
    return this._api.getVariables().pipe(
      tap(vars => setState(vars))
    );
  }

  @Action(Variables.DeleteVariable)
  deleteVariable({ setState, getState }: StateContext<VariablePair[]>, { id }: Variables.DeleteVariable) {
    setState(
      produce(getState(), (ctx: VariablePair[]) => {
        const index = ctx.findIndex(v => v.id === id);
        ctx.splice(index, 1);
      })
    )
  }

  @Action(Variables.UpdateOrCreateVariable)
  UpdateOrCreateVariable({ setState, getState }: StateContext<VariablePair[]>, { variable }: Variables.UpdateOrCreateVariable) {
    setState(
      produce(getState(), (ctx: VariablePair[]) => {
        const index = ctx.findIndex(v => v.id === variable.id);

        // if index is -1, means that variable still does not exist in state, so it needs to be pushed in context array, otherwise just update variable
        if(index == -1) {
          ctx.unshift(variable)
        } else {
          variable.id === 0 ? new Variables.DeleteVariable(variable.id) : ctx[index] = variable;
        }
      })
    )
  }

  @Selector()
  @ImmutableSelector()
  static GetVariables(state: VariablePair[]) {
    return (environment_id: number, department_id: number) => {
      return sortBy(state.filter(v => v.environment === environment_id && v.department === department_id), 'variable_name');
    };
  }
}
