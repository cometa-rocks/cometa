import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'cometa-error',
  templateUrl: 'error.dialog.html',
  styleUrls: ['./error.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
})
export class ErrorDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public error: Success) {
    // Convert error to object if necessary
    if (typeof this.error !== 'object') {
      this.error = JSON.parse(this.error);
    }
  }
}
