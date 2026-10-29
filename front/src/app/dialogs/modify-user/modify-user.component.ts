import { Component, Inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { ApiService } from '@services/api.service';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Select } from '@ngxs/store';
import { DepartmentsState } from '@store/departments.state';
import { Observable } from 'rxjs';
import { UserState } from '@store/user.state';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { AmDateFormatPipe } from '@pipes/am-date-format.pipe';
import { AmParsePipe } from '@pipes/am-parse.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { NgFor, AsyncPipe, KeyValuePipe } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { DisableAutocompleteDirective } from '../../directives/disable-autocomplete.directive';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { InputFocusService } from '@services/inputFocus.service';
import { KEY_CODES } from '@others/enums';

@Component({
  selector: 'modify-user',
  templateUrl: './modify-user.component.html',
  styleUrls: ['./modify-user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    DisableAutocompleteDirective,
    MatSelectModule,
    NgFor,
    MatOptionModule,
    MatButtonModule,
    AmParsePipe,
    AmDateFormatPipe,
    SortByPipe,
    AsyncPipe,
    KeyValuePipe,
  ],
})
export class ModifyUserComponent {
  @Select(DepartmentsState) departments$: Observable<Department[]>;
  @Select(UserState.GetPermissionTypes) permissions$: Observable<string[]>;

  rForm: UntypedFormGroup;
  inputFocus: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<ModifyUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { account: IAccount },
    private _api: ApiService,
    private fb: UntypedFormBuilder,
    private snack: MatSnackBar,
    private inputFocusService: InputFocusService
  ) {
    this.rForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', Validators.compose([Validators.required, Validators.email])],
      permission_name: ['', Validators.required],
      departments: [null],
    });
    this.rForm.get('name').setValue(this.data.account.name);
    this.rForm.get('email').setValue(this.data.account.email);
    this.rForm
      .get('permission_name')
      .setValue(this.data.account.permission_name);
    this.rForm.get('departments').setValue(this.data.account.departments || []);
  }

  modifyUser(values) {
    this._api.modifyAccount(this.data.account.user_id, values).subscribe(
      res => {
        if (res.success) {
          this.dialogRef.close(values);
          this.snack.open('Account modified successfully!', 'OK');
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
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.keyCode === KEY_CODES.ENTER && event.ctrlKey) {
      event.preventDefault();
      if (this.rForm.valid) {
        this.modifyUser(this.rForm.value);
      }
    }
  }
}
