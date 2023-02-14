import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '@services/api.service';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Select } from '@ngxs/store';
import { DepartmentsState } from '@store/departments.state';
import { Observable } from 'rxjs';
import { UserState } from '@store/user.state';

@Component({
  selector: 'modify-user',
  templateUrl: './modify-user.component.html',
  styleUrls: ['./modify-user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModifyUserComponent {

  @Select(DepartmentsState) departments$: Observable<Department[]>;
  @Select(UserState.GetPermissionTypes) permissions$: Observable<string[]>;

  rForm: UntypedFormGroup;

  constructor(
    private dialogRef: MatDialogRef<ModifyUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { account: IAccount },
    private _api: ApiService,
    private fb: UntypedFormBuilder,
    private snack: MatSnackBar
  ) {
    this.rForm = this.fb.group({
      'name': ['', Validators.required],
      'email': ['', Validators.compose([Validators.required, Validators.email])],
      'permission_name': ['', Validators.required],
      'departments': [null]
    });
    this.rForm.get('name').setValue(this.data.account.name);
    this.rForm.get('email').setValue(this.data.account.email);
    this.rForm.get('permission_name').setValue(this.data.account.permission_name);
    this.rForm.get('departments').setValue(this.data.account.departments || []);
  }

  modifyUser(values) {
    this._api.modifyAccount(this.data.account.user_id, values).subscribe(res => {
      if (res.success) {
        this.dialogRef.close(values);
        this.snack.open('Account modified successfully!', 'OK');
      } else {
        this.snack.open('An error ocurred', 'OK');
      }
    }, () => this.snack.open('An error ocurred', 'OK'));
  }

}
