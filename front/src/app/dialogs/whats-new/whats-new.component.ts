import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogModule } from '@angular/material/legacy-dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { SelectSnapshot, ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { ConfigState } from '@store/config.state';
import { classifyByProperty } from 'ngx-amvara-toolbox';
import { TranslateModule } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { NgIf, NgFor } from '@angular/common';

@Component({
    selector: 'whats-new',
    templateUrl: './whats-new.component.html',
    styleUrls: ['./whats-new.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatLegacyDialogModule, NgIf, NgFor, MatLegacyButtonModule, SafeHtmlPipe, TranslateModule]
})
export class WhatsNewDialog {

  /** Get plain changelog object from Config */
  @SelectSnapshot(CustomSelectors.GetConfigProperty('changelog')) changelog: Config['changelog'];

  /** Get formatted date from last changelog item, can be null */
  @ViewSelectSnapshot(ConfigState.getLastChangelogDate) date: string | null;

  /** Holds the two types of changes */
  changes: DialogChanges;

  constructor(
    public dialogRef: MatDialogRef<WhatsNewDialog>,
    @Inject(MAT_DIALOG_DATA) private data: LogChange[],
    private _sanitizer: DomSanitizer
  ) {
    // Filter changes to show on dialog
    this.changes = classifyByProperty(this.data, 'type');
    const randPoster = Math.floor(Math.random() * 3) + 1;
    // Sanitize poster url
    this.poster = this._sanitizer.bypassSecurityTrustUrl(`assets/img/poster_${randPoster}.svg`);
  }

  poster: SafeUrl;
}

interface DialogChanges {
  feature: LogChange[];
  bugfix: LogChange[];
}