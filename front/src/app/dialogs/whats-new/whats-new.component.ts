import { Component, ChangeDetectionStrategy, Inject, OnDestroy } from '@angular/core';
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
import { MatChipsModule } from '@angular/material/chips';
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
    MatChipsModule,
    MatLegacyButtonModule,
    SafeHtmlPipe,
    TranslateModule,
  ],
})
export class WhatsNewDialog implements OnDestroy {
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

  /** Available filter types */
  readonly filterTypes = [
    { key: 'feature', labelKey: 'whats_new.new_features' },
    { key: 'improved', labelKey: 'whats_new.improved' },
    { key: 'bugfix', labelKey: 'whats_new.bugfixes' },
    { key: 'security', labelKey: 'whats_new.security' },
    { key: 'breaking', labelKey: 'whats_new.breaking_changes' },
  ] as const;

  /** Selected filter types (default: all enabled) */
  private readonly defaultTypes: string[] = [
    'feature',
    'improved',
    'bugfix',
    'security',
    'breaking',
  ];
  selectedTypes = new Set<string>(this.defaultTypes);

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

  /** Toggle a filter chip */
  toggleType(type: string) {
    if (this.selectedTypes.has(type)) this.selectedTypes.delete(type);
    else this.selectedTypes.add(type);
  }

  /** Check if a given type is enabled */
  isEnabled(type: string): boolean {
    return this.selectedTypes.has(type);
  }

  /** Handle chip selection change with explicit selected boolean to avoid double toggles */
  onSelectionChange(type: string, selected: boolean) {
    if (selected) {
      this.selectedTypes.add(type);
    } else {
      this.selectedTypes.delete(type);
    }
  }

  /** Returns versions filtered by currently enabled categories */
  get filteredVersions(): any[] {
    const enabled = this.selectedTypes;
    return (this.versionsToShow || []).filter(v => {
      if (enabled.has('feature') && Array.isArray(v.features) && v.features.length > 0) return true;
      if (enabled.has('improved') && Array.isArray(v.improved) && v.improved.length > 0) return true;
      if (enabled.has('bugfix')) {
        const hasBugfixes = Array.isArray(v.bugfixes) && v.bugfixes.length > 0;
        const hasText = Array.isArray(v.text) && v.text.length > 0; // legacy
        if (hasBugfixes || hasText) return true;
      }
      if (enabled.has('security') && Array.isArray(v.security) && v.security.length > 0) return true;
      if (enabled.has('breaking') && Array.isArray(v.breaking) && v.breaking.length > 0) return true;
      return false;
    });
  }

  /** True when no chip is selected */
  get noFiltersSelected(): boolean {
    return this.selectedTypes.size === 0;
  }

  /** Reset filters when dialog is disposed */
  ngOnDestroy() {
    this.selectedTypes = new Set<string>(this.defaultTypes);
  }
}

interface DialogChanges {
  feature: LogChange[];
  bugfix: LogChange[];
}
