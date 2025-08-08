import { Component, ChangeDetectionStrategy, Inject, OnInit } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'mobile-validation-error',
  templateUrl: './mobile-validation-error.component.html',
  styleUrls: ['./mobile-validation-error.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule, MatLegacyTooltipModule, TranslateModule],
})
export class MobileValidationErrorDialog {
  static panelClass = 'no-resize-dialog';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<MobileValidationErrorDialog>
  ) {}
}
