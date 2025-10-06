import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { SelectSnapshot, ViewSelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { ConfigState } from '@store/config.state';
import { classifyByProperty } from 'ngx-amvara-toolbox';
import { TranslateModule } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { NgIf, NgFor, DatePipe } from '@angular/common';

@Component({
  selector: 'whats-new',
  templateUrl: './whats-new.component.html',
  styleUrls: ['./whats-new.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    NgIf,
    NgFor,
    DatePipe,
    MatLegacyButtonModule,
    SafeHtmlPipe,
    TranslateModule,
  ],
})
export class WhatsNewDialog {
  /** Get plain changelog object from Config */
  @SelectSnapshot(CustomSelectors.GetConfigProperty('changelog'))
  changelog: Config['changelog'];

  /** Get formatted date from last changelog item, can be null */
  @ViewSelectSnapshot(ConfigState.getLastChangelogDate) date: string | null;

  /** Current application version */
  @SelectSnapshot(CustomSelectors.GetConfigProperty('version'))
  version: Config['version'];

  /** Holds the two types of changes */
  changes: DialogChanges;

  /** Grouped changelog items to display, newest first */
  versionsToShow: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<WhatsNewDialog>,
    @Inject(MAT_DIALOG_DATA) private data: LogChange[],
    private _sanitizer: DomSanitizer
  ) {
    // Compute grouped versions to display based on current and previous version
    this.versionsToShow = this.computeVersionsToShow();

    // Keep legacy flat grouping for backward compatibility (not used by the template anymore)
    if (Array.isArray(this.data)) {
      this.changes = classifyByProperty(this.data, 'type');
    } else {
      this.changes = { feature: [], bugfix: [] };
    }

    const randPoster = Math.floor(Math.random() * 3) + 1;
    this.poster = this._sanitizer.bypassSecurityTrustUrl(
      `assets/img/poster_${randPoster}.svg`
    );

  }

  poster: SafeUrl;

  /**
   * Determine which changelog versions should be displayed in the dialog.
   * If a previous version is stored, show the slice between current and previous.
   * Otherwise, show only the latest changelog entry.
   */
  private computeVersionsToShow(): any[] {
    const changelog = this.changelog || [];
    if (!Array.isArray(changelog)) {
      return [];
    }
    // Show the entire changelog (it is already ordered newest-first in config.json)
    return changelog;
  }
}

interface DialogChanges {
  feature: LogChange[];
  bugfix: LogChange[];
}
