import { State, Action, StateContext, Selector } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { tap } from 'rxjs/operators';
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

  // @Action(Variables.SetVariables)
  // setVariables({ setState, getState }: StateContext<VariablePair[]>, { environment_name, department_name, variables }: Variables.SetVariables) {
  //   const vars = getState().filter(v => !(v.environment.environment_name === environment_name && v.department.department_name === department_name));
  //   setState([ ...vars, ...variables ])
  // }

  // @Action(Variables.UpdateVariable)
  // updateVariable({ setState, getState }: StateContext<VariablePair[]>, { variable }: Variables.UpdateVariable) {
  //   setState(
  //     produce(getState(), (ctx: VariablePair[]) => {
  //       const index = ctx.findIndex(v => v.id === variable.id);
  //       ctx[index] = variable;
  //     })
  //   )
  // }

  @Selector()
  @ImmutableSelector()
  static GetVariables(state: VariablePair[]) {
    return (environment_id: number, department_id: number) => {
      return sortBy(state.filter(v => v.environment === environment_id && v.department === department_id), 'variable_name');
    };
  }

}
