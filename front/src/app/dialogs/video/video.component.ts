import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { BrowserComboTextPipe } from '../../pipes/browser-combo-text.pipe';
import { BrowserIconPipe } from '@pipes/browser-icon.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { NgIf, AsyncPipe, TitleCasePipe } from '@angular/common';

@Component({
    selector: 'video-player',
    templateUrl: './video.component.html',
    styleUrls: ['./video.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgIf, MatLegacyProgressSpinnerModule, MatLegacyButtonModule, MatLegacyTooltipModule, MatIconModule, TranslateModule, BrowserIconPipe, BrowserComboTextPipe, AsyncPipe, TitleCasePipe]
})
export class VideoComponent {

  showHeader$ = new BehaviorSubject<boolean>(false);

  src: SafeUrl;

  constructor(
    public dialogRef: MatDialogRef<VideoComponent>,
    @Inject(MAT_DIALOG_DATA) public result: FeatureResult,
    private _sanitizer: DomSanitizer
  ) {
    this.src = this._sanitizer.bypassSecurityTrustUrl(this.result.video_url);
  }

}
