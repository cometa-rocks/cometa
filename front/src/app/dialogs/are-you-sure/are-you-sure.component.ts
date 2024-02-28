import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { TranslateService } from '@ngx-translate/core';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

@Component({
  selector: 'are-you-sure',
  templateUrl: './are-you-sure.component.html',
  styleUrls: ['./are-you-sure.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatLegacyDialogModule, MatLegacyButtonModule],
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
        this.data[key] = this._translate.instant(
          this.data[key].substring(this.translatePrefix.length)
        );
      }
    }
  }
}

export interface AreYouSureData {
  title?: string;
  description?: string;
}
