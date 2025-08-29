import { Component, ChangeDetectionStrategy, Inject, OnInit } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
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
import { LogService } from '@services/log.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'video-player',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgIf,
    MatLegacyProgressSpinnerModule,
    MatLegacyButtonModule,
    MatLegacyTooltipModule,
    MatIconModule,
    TranslateModule,
    BrowserIconPipe,
    BrowserComboTextPipe,
    AsyncPipe,
    TitleCasePipe,
    CommonModule,
  ],
})
export class VideoComponent implements OnInit {
  showHeader$ = new BehaviorSubject<boolean>(false);

  src: SafeUrl;
  result: any;

  constructor(
    public dialogRef: MatDialogRef<VideoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private _sanitizer: DomSanitizer,
    private log: LogService
  ) {
    // Handle both data formats:
    // 1. { result: ..., video_url: ... } from feature-actions and main-view
    // 2. Direct result object with video_url property from feature-run
    if (this.data.video_url && this.data.result) {
      // New format with separate video_url and result
      this.src = this._sanitizer.bypassSecurityTrustUrl(this.data.video_url);
      this.result = this.data.result;
    } else if (this.data.video_url) {
      // Old format where data is the result itself
      this.src = this._sanitizer.bypassSecurityTrustUrl(this.data.video_url);
      this.result = this.data;
    }
    this.log.msg('4', '=== VideoComponent() === Im inside VideoComponent() Results', 'video', this.data);
  }

  ngOnInit() {
  }
}
