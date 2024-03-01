import { Component, Inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { ApiService } from '@services/api.service';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { Select, Store } from '@ngxs/store';
import { DepartmentsState } from '@store/departments.state';
import { Observable } from 'rxjs';
import { UserState } from '@store/user.state';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { NgFor, AsyncPipe, KeyValuePipe } from '@angular/common';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { EnvironmentsState } from '@store/environments.state';
import { Environments } from '@store/actions/environments.actions';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';

@Component({
  selector: 'modify-feature-in-department',
  templateUrl: './modify-feature-in-department.html',
  styleUrls: ['./modify-feature-in-department.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    ReactiveFormsModule,
    MatLegacyFormFieldModule,
    MatLegacyInputModule,
    DisableAutocompleteDirective,
    MatLegacySelectModule,
    NgFor,
    MatLegacyOptionModule,
    MatLegacyButtonModule,
    AmParsePipe,
    AmDateFormatPipe,
    SortByPipe,
    AsyncPipe,
    KeyValuePipe,
  ],
})
export class ModifyFeatureInDepartmentComponent implements OnInit {
  @Select(EnvironmentsState) environments$: Observable<Environment[]>;

  rForm: UntypedFormGroup;
  department: Department;
  
  constructor(
    private dialogRef: MatDialogRef<ModifyFeatureInDepartmentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _api: ApiService,
    private fb: UntypedFormBuilder,
    private snack: MatSnackBar,
    private _store: Store
  ) {
    this.department = data;
    console.log(data);
    this.rForm = this.fb.group({
      selected_environment: ['', Validators.required],
      department: data.department_id,
    });
  }

  ngOnInit() {
    return this._store.dispatch(new Environments.GetEnvironments());
  }

  changeEnvironment(values) {
    this._api.modifyFeatureEnvironmentInDepartment(values).subscribe(
      res => {
        if (res.success) {
          this.dialogRef.close(values);
          let responseBody:any = res
          console.log(res)
          let updateCount = responseBody.department;
          let message = `Environment modified successfully!
          ${updateCount.feature} Feature, 
          ${updateCount.feature_history} Feature History
          `
          this.snack.open(message, 'OK');
        } else {
          this.snack.open('An error ocurred', 'OK');
        }
      },
      () => this.snack.open('An error ocurred', 'OK')
    );
  }
}
