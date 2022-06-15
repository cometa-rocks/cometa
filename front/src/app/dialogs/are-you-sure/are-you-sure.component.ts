import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'are-you-sure',
  templateUrl: './are-you-sure.component.html',
  styleUrls: ['./are-you-sure.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AreYouSureDialog {

  translatePrefix = 'translate:';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AreYouSureData,
    private _translate: TranslateService
  ) {
    // Check if passed data needs to be translated
    for (const key in this.data) {
      if (this.data[key] && this.data[key].startsWith(this.translatePrefix)) {
        this.data[key] = this._translate.instant(this.data[key].substring(this.translatePrefix.length))
      }
    }
  }
}

export interface AreYouSureData {
  title?: string;
  description?: string;
}