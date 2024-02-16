import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

@Component({
  selector: 'accounts-dialog',
  templateUrl: './accounts-dialog.component.html',
  styleUrls: ['./accounts-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsDialog {
  page: number = 0;
  start: number = 0;
  amount: number = 5;
  increment: number = 5;
  maxPage = Math.floor(this.data.users.length / this.increment);

  constructor(@Inject(MAT_DIALOG_DATA) public data: AccountsDialogData) {}

  nextPage() {
    this.page += 1;
    this.start = this.page * this.increment;
    this.amount = this.start + this.increment;
  }
  previousPage() {
    this.page -= 1;
    this.start = this.page * this.increment;
    this.amount = this.start + this.increment;
  }
}

export interface AccountsDialogData {
  department_name: string;
  users: IAccount[];
}
