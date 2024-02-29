import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { EnterValueComponent } from '@dialogs/enter-value/enter-value.component';
import { Select, Store } from '@ngxs/store';
import { DepartmentsState } from '@store/departments.state';
import { UserState } from '@store/user.state';
import { Subscribe } from 'app/custom-decorators';
import { filter, map, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Departments } from '@store/actions/departments.actions';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { DepartmentComponent } from './department/department.component';
import { NgFor, NgIf, AsyncPipe } from '@angular/common';

@Component({
  selector: 'admin-departments',
  templateUrl: './departments.component.html',
  styleUrls: ['./departments.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgFor,
    DepartmentComponent,
    NgIf,
    MatLegacyButtonModule,
    MatIconModule,
    SortByPipe,
    AsyncPipe,
  ],
})
export class DepartmentsComponent implements OnInit {
  constructor(
    private _api: ApiService,
    private _dialog: MatDialog,
    private _store: Store
  ) {}

  @Select(UserState.GetPermission('create_department'))
  canCreateDepartment$: Observable<boolean>;
  @Select(DepartmentsState) departments$: Observable<Department[]>;

  ngOnInit() {
    return this._store.dispatch(new Departments.GetAdminDepartments());
  }

  trackByFn(index, item: Department) {
    return item.department_id;
  }

  @Subscribe()
  newDepartment() {
    return this._dialog
      .open(EnterValueComponent, {
        autoFocus: true,
        data: {
          word: 'Department',
        },
      })
      .afterClosed()
      .pipe(
        map(res => res.value),
        filter(value => !!value),
        switchMap(value => this._api.createDepartment(value)),
        switchMap(response =>
          this._store.dispatch(
            new Departments.AddAdminDepartment({
              department_id: response.department_id,
              department_name: response.department_name,
            })
          )
        )
      );
  }
}
