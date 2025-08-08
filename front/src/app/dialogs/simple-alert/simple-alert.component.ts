import { Component, ChangeDetectionStrategy, Inject, HostListener } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'simple-alert',
  templateUrl: './simple-alert.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class SimpleAlertDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SimpleAlertData,
    private dialogRef: MatDialogRef<SimpleAlertDialog>
  ) {}

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Close dialog with 'false' response when Escape is pressed
      this.dialogRef.close(false);
    }
  }
} 