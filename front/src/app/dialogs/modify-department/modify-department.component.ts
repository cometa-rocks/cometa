import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';
import { ApiService } from '@services/api.service';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { SelectSnapshot, ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { DepartmentsState } from '@store/departments.state';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Departments } from '@store/actions/departments.actions';
import { BehaviorSubject } from 'rxjs';
import { MatLegacyCheckboxChange as MatCheckboxChange } from '@angular/material/legacy-checkbox';

@Component({
  selector: 'modify-department',
  templateUrl: './modify-department.component.html',
  styleUrls: ['./modify-department.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModifyDepartmentComponent {
  rForm: UntypedFormGroup;
  timeoutForm: UntypedFormGroup;
  loading: boolean = false;

  expireDaysChecked$ = new BehaviorSubject<boolean>(false);

  @SelectSnapshot(DepartmentsState) departments: Department[];
  @ViewSelectSnapshot(UserState) account: UserInfo;

  /** Current selected department */
  department: Department;

  constructor(
    private dialogRef: MatDialogRef<ModifyDepartmentComponent>,
    @Inject(MAT_DIALOG_DATA) private department_id: number,
    private _api: ApiService,
    private fb: UntypedFormBuilder,
    private snack: MatSnackBar,
    private _store: Store
  ) {
    this.department = this.departments.find(
      dept => dept.department_id === this.department_id
    );
    const expireDays = this.department.settings?.result_expire_days
      ? parseInt(this.department.settings.result_expire_days, 10)
      : 90;
    this.rForm = this.fb.group({
      department_name: [this.department.department_name, Validators.required],
      continue_on_failure: [
        {
          value: this.department.settings.continue_on_failure,
          disabled: this.account?.settings?.continue_on_failure,
        },
      ],
      step_timeout: [
        this.department.settings?.step_timeout || 60,
        [
          Validators.required,
          Validators.compose([
            Validators.min(1),
            Validators.max(7205),
            Validators.maxLength(4),
          ]),
        ],
      ],
      result_expire_days: [expireDays],
    });
    this.timeoutForm = this.fb.group({
      step_timeout_from: [
        '',
        Validators.compose([
          Validators.min(1),
          Validators.max(7205),
          Validators.maxLength(4),
        ]),
      ],
      step_timeout_to: [
        '',
        Validators.compose([
          Validators.min(1),
          Validators.max(7205),
          Validators.maxLength(4),
        ]),
      ],
    });
    this.expireDaysChecked$.next(!!this.department.settings.result_expire_days);
  }

  handleExpires = ({ checked }: MatCheckboxChange) => {
    this.expireDaysChecked$.next(checked);
    if (checked) {
      this.rForm
        .get('result_expire_days')
        .setValidators(
          Validators.compose([Validators.required, Validators.min(1)])
        );
    } else {
      this.rForm.get('result_expire_days').clearValidators();
    }
    this.rForm.get('result_expire_days').updateValueAndValidity();
  };

  modifyDepartment(values) {
    const payload = {
      department_name: values.department_name,
      settings: {
        ...this.department.settings,
        continue_on_failure: values.continue_on_failure,
        step_timeout: values.step_timeout,
        result_expire_days: this.expireDaysChecked$.getValue()
          ? values.result_expire_days
          : null,
      },
    };
    this._api.modifyDepartment(this.department_id, payload).subscribe(
      res => {
        if (res.success) {
          this._store.dispatch(
            new Departments.UpdateDepartment(this.department_id, payload)
          );
          // this.dialogRef.close();
          this.snack.open('Department modified successfully!', 'OK');
        } else {
          this.snack.open('An error ocurred', 'OK');
        }
      },
      () => this.snack.open('An error ocurred', 'OK')
    );
  }
}
