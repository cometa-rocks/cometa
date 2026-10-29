import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface SimpleAlertData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'simple-alert',
  template: `
    <h2 mat-dialog-title>{{ data?.title }}</h2>
    <mat-dialog-content>
      <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; padding: 0;">{{ data?.message }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button color="primary" [mat-dialog-close]="true">
        OK
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class SimpleAlertDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SimpleAlertData,
    private dialogRef: MatDialogRef<SimpleAlertDialog>
  ) {}
} 