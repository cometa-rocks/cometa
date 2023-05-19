import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'cometa-all-screenshot',
  templateUrl: './all-schreenshots.component.html',
  styleUrls: ['./all-schreenshots.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllScreenshotComponent {

  images: SafeStyle[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) private screenshots: string[],
    public dialogRef: MatDialogRef<AllScreenshotComponent>,
    private _sanitizer: DomSanitizer
  ) {
    this.screenshots.forEach(item => {
      const screenshot =  this._sanitizer.bypassSecurityTrustStyle(`url(/v2/screenshots/${item})`);
      this.images.push(screenshot)
    })
  }

}
