import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ApiService } from '@services/api.service';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';

@Component({
  selector: 'modify-department-timeout',
  templateUrl: './modify-department-timeout.component.html',
  styleUrls: ['./modify-department-timeout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    ReactiveFormsModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    MatLegacyButtonModule,
  ],
})
export class ModifyDepartmentTimeoutComponent {
  timeoutForm: UntypedFormGroup;
  loading: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) private department_id: number,
    private _api: ApiService,
    private snack: MatSnackBar,
    private fb: UntypedFormBuilder
  ) {
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
  }

  applyGlobalTimeout(ev: Event) {
    const options = this.timeoutForm.value;
    // prevents whole popup from closing
    ev.preventDefault();

    // disable button while http post is processed
    this.loading = true;
    this._api
      .applyDepartmentStepsTimeout(this.department_id, options)
      .subscribe({
        next: res => {
          let result = JSON.parse(res);

          // if timeout modification XHR was successfull, show user how many steps and features were modified
          if (result.success) {
            result.total_steps_updated === 0
              ? this.snack.open('No steps with specified timeout', 'OK')
              : this.snack.open(
                  `features updated:${result.total_features_updated}, steps updated:${result.total_steps_updated}`,
                  'OK'
                );
          }
          // enable button again
          this.loading = false;
          // reset input values
          this.resetGlobalTimeoutInputs();
        },
        error: err => {
          let error = JSON.parse(err.error);

          // show user the cause of error
          this.snack.open(error.error, 'OK');
          this.loading = false;
        },
      });
  }

  // resets the input value for global timeout modifiers
  resetGlobalTimeoutInputs() {
    this.timeoutForm.get('step_timeout_from').setValue('');
    this.timeoutForm.get('step_timeout_to').setValue('');
  }
}
