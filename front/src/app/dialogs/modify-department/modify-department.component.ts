import { Component, Inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ApiService } from '@services/api.service';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { SelectSnapshot, ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { DepartmentsState } from '@store/departments.state';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { Departments } from '@store/actions/departments.actions';
import { BehaviorSubject } from 'rxjs';
import {
  MatLegacyCheckboxChange as MatCheckboxChange,
  MatLegacyCheckboxModule,
} from '@angular/material/legacy-checkbox';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { LetDirective } from '../../directives/ng-let.directive';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { InputFocusService } from '../../services/inputFocus.service';
import { KEY_CODES } from '@others/enums';

@Component({
  selector: 'modify-department',
  templateUrl: './modify-department.component.html',
  styleUrls: ['./modify-department.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    ReactiveFormsModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    DisableAutocompleteDirective,
    MatLegacyCheckboxModule,
    MatLegacyTooltipModule,
    LetDirective,
    MatLegacyButtonModule,
    TranslateModule,
    AsyncPipe,
  ],
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
    private _store: Store,
    private inputFocusService: InputFocusService
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
          disabled: this.account?.settings?.continue_on_failure === false,
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
      queue_name: [this.department.settings?.queue_name || ''],
      telegram_chat_ids: [this.department.settings?.telegram_chat_ids || ''],
      validate_duplicate_feature_names: [
        this.department.settings?.validate_duplicate_feature_names === true,
      ],
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
    // Prevent submit if form is invalid or not dirty
    if (!this.rForm.valid || !this.rForm.dirty) {
      return;
    }
    const payload = {
      department_name: values.department_name,
      settings: {
        ...this.department.settings,
        continue_on_failure: values.continue_on_failure,
        step_timeout: values.step_timeout,
        result_expire_days: this.expireDaysChecked$.getValue()
          ? values.result_expire_days
          : null,
        queue_name: values.queue_name,
        telegram_chat_ids: values.telegram_chat_ids,
        validate_duplicate_feature_names: values.validate_duplicate_feature_names,
      },
    };
    this._api.modifyDepartment(this.department_id, payload).subscribe(
      res => {
        if (res.success) {
          this._store.dispatch(
            new Departments.UpdateDepartment(this.department_id, payload)
          );
          this.dialogRef.close();
          this.snack.open('Department modified successfully!', 'OK');
        } else {
          this.snack.open('An error ocurred', 'OK');
        }
      },
      () => this.snack.open('An error ocurred', 'OK')
    );
  }

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.keyCode === KEY_CODES.ENTER && event.ctrlKey) {
      event.preventDefault();
      if (!this.loading) {
        // Call the modifyDepartment function with the form values
        this.modifyDepartment(this.rForm.value);
      }
    }
  }
}
