import { Component, ChangeDetectionStrategy, Inject, HostListener } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'mobile-validation-error',
  templateUrl: './mobile-validation-error.component.html',
  styleUrls: ['./mobile-validation-error.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatTooltipModule, TranslateModule],
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
