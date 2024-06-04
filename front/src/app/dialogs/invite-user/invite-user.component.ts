import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatLegacyChipListChange as MatChipListChange,
  MatLegacyChipsModule,
} from '@angular/material/legacy-chips';
import {
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { ApiService } from '@services/api.service';
import { UserState } from '@store/user.state';
import { BehaviorSubject } from 'rxjs';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, AsyncPipe } from '@angular/common';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';

@Component({
  selector: 'invite-user',
  templateUrl: './invite-user.component.html',
  styleUrls: ['./invite-user.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatLegacyDialogModule,
    MatLegacyFormFieldModule,
    MatLegacyChipsModule,
    NgFor,
    MatIconModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    MatLegacyInputModule,
    MatLegacyButtonModule,
    AsyncPipe,
    SortByPipe,
  ],
})
export class InviteUserDialog implements OnInit {
  @ViewSelectSnapshot(UserState.RetrieveUserDepartments)
  departments: Department[];

  inviteForm: UntypedFormGroup;

  constructor(
    private dialogRef: MatDialogRef<InviteUserDialog>,
    private _fb: UntypedFormBuilder,
    private _api: ApiService,
    private _snackBar: MatSnackBar
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
  addAddress(change: MatChipListChange) {
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
}
