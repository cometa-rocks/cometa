import { Component, ChangeDetectionStrategy, Inject, HostListener } from '@angular/core';
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
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MobileValidationErrorData,
    private dialogRef: MatDialogRef<MobileValidationErrorDialog>
  ) {}

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Close dialog with 'ignore' response when Escape is pressed
      this.dialogRef.close('ignore');
    }
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Close dialog with 'ignore' response when Escape is pressed
      this.dialogRef.close('ignore');
    }
  }
  
}
