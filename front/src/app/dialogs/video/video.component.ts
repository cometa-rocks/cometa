import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MatDialogRef as MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'video-player',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
