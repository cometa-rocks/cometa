import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'cometa-error',
  templateUrl: 'error.dialog.html',
  styleUrls: ['./error.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class ErrorDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public error: Success) {
    // Convert error to object if necessary
    if (typeof this.error !== 'object') {
      this.error = JSON.parse(this.error);
    }
  }
}
