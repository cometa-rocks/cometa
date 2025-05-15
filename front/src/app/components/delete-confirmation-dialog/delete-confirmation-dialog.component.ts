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
  selector: 'app-delete-confirmation-dialog',
  templateUrl: './delete-confirmation-dialog.component.html',
  styleUrls: ['./delete-confirmation-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    MatLegacyDialogModule,
    MatLegacyButtonModule,
    MatIconModule
  ]
})
export class DeleteConfirmationDialogComponent {
  translatePrefix = 'translate:';

  constructor(
    public dialogRef: MatDialogRef<DeleteConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _translate: TranslateService
  ) {
    // Set dialog width
    dialogRef.updateSize('600px');

    // Check if passed data needs to be translated
    if (this.data) {
      for (const key in this.data) {
        if (this.data[key] && typeof this.data[key] === 'string' && this.data[key].startsWith(this.translatePrefix)) {
          this.data[key] = this._translate.instant(
            this.data[key].substring(this.translatePrefix.length)
          );
        }
      }
    }
  }

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onYesClick(): void {
    this.dialogRef.close(true);
  }
} 