import { State, Action, StateContext } from '@ngxs/store';
import { ApiService } from '@services/api.service';
import { map, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Departments } from './actions/departments.actions';
import produce from 'immer';

/**
 * @description Contains the state of departments for Admin and Users
 * @author Alex Barba
 */
@State<Department[]>({
  name: 'departments',
  defaults: []
})
@Injectable()
export class DepartmentsState {

  constructor( private _api: ApiService ) { }

    @Action(Departments.GetAdminDepartments)
    getAdminDepartments({ setState }: StateContext<Department[]>) {
        return this._api.getDepartments().pipe(
            map(json => json.results),
            tap(departments => setState(departments))
        );
    }

    @Action(Departments.AddAdminDepartment)
    setAdminDepartment({ setState, getState }: StateContext<Department[]>, { department }: Departments.AddAdminDepartment) {
      // Add department only if doesn't exist already
      if (!getState().some(dept => dept.department_id === department.department_id)) {
        // Add new department
        setState([ ...getState(), department ]);
      }
    }

    @Action(Departments.UpdateDepartment)
    updateDepartment({ setState, getState }: StateContext<Department[]>, { departmentId, options }: Departments.UpdateDepartment) {
      setState(
        produce(getState(), (ctx: Department[]) => {
          const index = ctx.findIndex(dept => dept.department_id === departmentId);
          if (index !== -1) {
            ctx[index] = {
              ...ctx[index],
              ...options
            }
          }
        })
      )
    }

    @Action(Departments.RemoveAdminDepartment)
    removeAdminDepartment({ setState, getState }: StateContext<Department[]>, { department_id }: Departments.RemoveAdminDepartment) {
      setState(getState().filter(dept => dept.department_id !== department_id));
    }

}
