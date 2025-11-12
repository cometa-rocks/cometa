import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, ChangeDetectionStrategy, OnInit, HostListener } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatChipListboxChange, // Changed from MatChipListChange to MatChipListboxChange for Angular 17 compatibility
  MatChipsModule,
} from '@angular/material/chips';
import {
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { ApiService } from '@services/api.service';
import { UserState } from '@store/user.state';
import { BehaviorSubject } from 'rxjs';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, AsyncPipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { InputFocusService } from '@services/inputFocus.service';

@Component({
  selector: 'invite-user',
  templateUrl: './invite-user.component.html',
  styleUrls: ['./invite-user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatChipsModule,
    NgFor,
    MatIconModule,
    MatSelectModule,
    MatOptionModule,
    MatInputModule,
    MatButtonModule,
    AsyncPipe,
    SortByPipe,
  ],
})
export class InviteUserDialog implements OnInit {
  @ViewSelectSnapshot(UserState.RetrieveUserDepartments)
  departments: Department[];

  inviteForm: UntypedFormGroup;
  inputFocus: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<InviteUserDialog>,
    private _fb: UntypedFormBuilder,
    private _api: ApiService,
    private _snackBar: MatSnackBar,
    private inputFocusService: InputFocusService
  ) {
    this.inviteForm = this._fb.group({
      email_show: [''],
      departments: [[], Validators.required],
      custom_text: [''],
    });
  }

  ngOnInit() {
    if (this.departments.length === 1) {
      this.inviteForm
        .get('departments')
        .setValue([this.departments[0].department_id]);
    }
  }

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  emails$ = new BehaviorSubject<string[]>([]);

  sendInvites(values) {
    return this._api
      .sendInvite(
        this.emails$.getValue(),
        values.departments,
        values.custom_text
      )
      .subscribe(res => {
        if (res.success) {
          this._snackBar.open('Invite has been sent', 'OK');
          this.dialogRef.close();
        } else if (res.handled) {
          this.dialogRef.close();
        } else {
          this._snackBar.open('An error occurred', 'OK');
        }
      });
  }

  // Add address to the addresses array
  addAddress(change: MatChipListboxChange) { // Changed from MatChipListChange to MatChipListboxChange for Angular 17 compatibility
    // Check email value
    if (change.value) {
      // Get current addresses
      const addresses = this.emails$.getValue();
      // Perform push only if address doesn't exist already
      if (!addresses.includes(change.value)) {
        addresses.push(change.value);
        this.emails$.next(addresses);
      }
      this.inviteForm.get('email_show').setValue('');
    }
  }

  // Remove given address from addresses array
  removeAddress(email: string) {
    if (email) {
      let addresses = this.emails$.getValue();
      addresses = addresses.filter(addr => addr !== email);
      this.emails$.next(addresses);
    }
  }

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }

  // Listen for Ctrl+Enter and trigger sendInvites if form is valid
  @HostListener('document:keydown', ['$event'])
  handleCtrlEnter(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'Enter' && this.inviteForm.valid) {
      this.sendInvites(this.inviteForm.value);
    }
  }
}
