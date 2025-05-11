import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { TranslateService } from '@ngx-translate/core';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cometa-restore-confirmation-dialog',
  templateUrl: './restore-confirmation-dialog.component.html',
  styleUrls: ['./restore-confirmation-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatLegacyButtonModule,
    MatLegacyDialogModule,
    MatIconModule
  ]
})
export class RestoreConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<RestoreConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _translate: TranslateService
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
} 