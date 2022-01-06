import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'cometa-screenshot',
  templateUrl: './screenshot.component.html',
  styleUrls: ['./screenshot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScreenshotComponent {

  image: SafeStyle;

  constructor(
    @Inject(MAT_DIALOG_DATA) private screenshot: string,
    public dialogRef: MatDialogRef<ScreenshotComponent>,
    private _sanitizer: DomSanitizer
  ) {
    this.image = this._sanitizer.bypassSecurityTrustStyle(`url(/v2/screenshots/${this.screenshot})`);
  }

}
