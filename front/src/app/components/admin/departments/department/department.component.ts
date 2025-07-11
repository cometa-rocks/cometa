import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Store, Select } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModifyDepartmentComponent } from '@dialogs/modify-department/modify-department.component';
import { ModifyDepartmentTimeoutComponent } from '@dialogs/modify-department-timeout/modify-department-timeout.component';
import { Departments } from '@store/actions/departments.actions';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';
import {
  AccountsDialog,
  AccountsDialogData,
} from '@dialogs/accounts-dialog/accounts-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { NgIf, NgClass, AsyncPipe } from '@angular/common';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';

@Component({
  selector: 'department',
  templateUrl: './department.component.html',
  styleUrls: ['./department.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    DisableAutocompleteDirective,
    NgIf,
    NgClass,
    MatIconModule,
    AsyncPipe,
  ],
})
export class DepartmentComponent {
  @Select(UserState.GetPermission('edit_department'))
  canEditDepartment$: Observable<boolean>;
  @Select(UserState.GetPermission('delete_department'))
  canDeleteDepartment$: Observable<boolean>;
  @Select(UserState.GetPermission('show_department_users'))
  canSeeUsers$: Observable<boolean>;

  constructor(
    private _api: ApiService,
    private _snack: MatSnackBar,
    private _dialog: MatDialog,
    private _store: Store
  ) {}

  @Input() department: Department;

  modify = new BehaviorSubject<boolean>(false);

  saveOrEdit() {
    this._dialog.open(ModifyDepartmentComponent, {
      data: this.department.department_id,
      panelClass: 'modify-department-panel',
    });
  }

  showUsers() {
    if (this.department.users.length < 1) return;
    this._dialog.open(AccountsDialog, {
      data: {
        users: this.department.users,
        department_name: this.department.department_name,
      } as AccountsDialogData,
      width: '90%',
    });
  }

  removeIt() {
    this._dialog
      .open(AreYouSureDialog, {
        data: {
          title: 'translate:you_sure.delete_item_title',
          description: 'translate:you_sure.delete_item_desc',
        } as AreYouSureData,
        autoFocus: true,
      })
      .afterClosed()
      .subscribe(answer => {
        if (answer)
          this._api.deleteDepartment(this.department.department_id).subscribe(
            res => {
              if (res.success) {
                this._store.dispatch(
                  new Departments.RemoveAdminDepartment(
                    this.department.department_id
                  )
                );
                this._snack.open('Department removed successfully!', 'OK');
              }
            },
            err => this._snack.open('An error ocurred', 'OK')
          );
      });
  }

  // open modify department timeout dialog
  onModifyTimeoutClick() {
    this._dialog.open(ModifyDepartmentTimeoutComponent, {
      data: this.department.department_id,
      panelClass: 'modify-department-timeout-panel',
    });
  }
}
