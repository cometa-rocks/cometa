import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiService } from '@services/api.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'modify-password',
  templateUrl: './modify-password.component.html',
  styleUrls: ['./modify-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModifyPasswordComponent {

  rForm: UntypedFormGroup;

  constructor(
    private dialogRef: MatDialogRef<ModifyPasswordComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { account: IAccount },
    private _api: ApiService,
    private fb: UntypedFormBuilder,
    private snack: MatSnackBar
  ) {
    this.rForm = this.fb.group({
      'password': ['', Validators.required],
      'repassword': ['', Validators.required]
    });
  }

  modifyUser(values) {
    this._api.modifyPassword(this.data.account.user_id, values.repassword).subscribe(res => {
      if (res.success) {
        this.dialogRef.close();
        this.snack.open('Password modified successfully!', 'OK');
      } else {
        this.snack.open('An error ocurred', 'OK');
      }
    }, () => this.snack.open('An error ocurred', 'OK'));
  }

}
