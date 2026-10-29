import { Component, ChangeDetectionStrategy, Inject, HostListener } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { KEY_CODES } from '@others/enums';

@Component({
  selector: 'are-you-sure',
  templateUrl: './are-you-sure.component.html',
  styleUrls: ['./are-you-sure.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class AreYouSureDialog {
  static panelClass = 'no-resize-dialog';
  translatePrefix = 'translate:';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AreYouSureData,
    private _translate: TranslateService,
    private dialogRef: MatDialogRef<AreYouSureDialog>
  ) {
    // Check if passed data needs to be translated
    for (const key in this.data) {
      if (this.data[key] && this.data[key].startsWith(this.translatePrefix)) {
        this.data[key] = this._translate.instant(
          this.data[key].substring(this.translatePrefix.length)
        );
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.keyCode === KEY_CODES.ESCAPE) {
      event.preventDefault();
      // Close dialog with 'false' (No) response
      this.dialogRef.close(false);
    }
  }
}

export interface AreYouSureData {
  title?: string;
  description?: string;
}
