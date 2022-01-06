import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'cometa-error',
  templateUrl: 'error.dialog.html',
  styleUrls: ['./error.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorDialog {

  constructor(
    @Inject(MAT_DIALOG_DATA) public error: Success
  ) {
    // Convert error to object if necessary
    if (typeof this.error !== 'object') {
      this.error = JSON.parse(this.error);
    }
  }

}
