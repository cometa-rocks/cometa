import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

export interface MobileValidationErrorData {
  title?: string;
  message?: string;
  errors: Array<{stepIndex: number, stepContent: string, error: string, quoteStart?: number, quoteEnd?: number}>;
}

export type MobileValidationAction = 'ignore' | 'correct';

@Component({
  selector: 'mobile-validation-error',
  template: `
    <h2 mat-dialog-title>{{ data?.title }}</h2>
    <mat-dialog-content>
      <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; padding: 0;">{{ data?.message }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button color="warn" [mat-dialog-close]="'ignore'">
        Ignore
      </button>
      <button mat-stroked-button color="primary" [mat-dialog-close]="'correct'">
        Correct
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class MobileValidationErrorDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MobileValidationErrorData,
    private dialogRef: MatDialogRef<MobileValidationErrorDialog>
  ) {}
}
