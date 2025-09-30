import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialog as MatDialog,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

import { ApiService } from '@services/api.service';
import { ImportJSONComponent } from '@dialogs/import-json/import-json.component';
import { ImportFeaturesTableComponent } from './import-features-table/import-features-table.component';

type ImportMode = 'file' | 'paste';
type RawExport = any;

export interface ImportItem {
  original: any;
  selected: boolean;
  name: string;
  error: string | null;
}

const DEFAULT_BROWSER = {
  os: 'Generic',
  cloud: 'local',
  device: null,
  browser: 'chrome',
  os_version: 'Selenium',
  real_mobile: false,
  browser_version: 'latest',
};

@Component({
  selector: 'cometa-import-features-dialog',
  templateUrl: './import-features.component.html',
  styleUrls: ['./import-features.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyDialogModule,
    MatLegacyButtonModule,
    MatLegacyCheckboxModule,
    MatLegacyInputModule,
    FormsModule,
    NgIf,
    MatIconModule,
    ImportFeaturesTableComponent,
  ],
})
export class ImportFeaturesDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ImportFeaturesDialogComponent>,
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  busy = false;
  mode: ImportMode = 'file';
  lastFileName: string | null = null;

  private fileItems: ImportItem[] = [];
  private pasteItems: ImportItem[] = [];
  private fileAllSelected = false;
  private pasteAllSelected = false;
  private fileParseError: string | null = null;
  private pasteParseError: string | null = null;

  get currentItems(): ImportItem[] {
    return this.mode === 'file' ? this.fileItems : this.pasteItems;
  }

  get currentAllSelected(): boolean {
    return this.mode === 'file' ? this.fileAllSelected : this.pasteAllSelected;
  }

  get currentParseError(): string | null {
    return this.mode === 'file' ? this.fileParseError : this.pasteParseError;
  }

  get hasItems(): boolean {
    return this.currentItems.length > 0;
  }

  setMode(mode: ImportMode) {
    this.mode = mode;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.lastFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result || 'null')) as RawExport;
        this.populateFromJson(json, 'file');
        this.mode = 'file';
      } catch (err) {
        this.setParseError('file', 'Invalid JSON');
        this.setItems('file', []);
      }
    };
    reader.readAsText(file);
  }

  openPasteDialog() {
    const ref = this.dialog.open(ImportJSONComponent, {
      width: '620px',
      autoFocus: true,
    });

    ref.afterClosed().subscribe(success => {
      if (!success) {
        return;
      }
      try {
        const json = JSON.parse(ref.componentInstance.json || '');
        this.populateFromJson(json, 'paste');
        ref.componentInstance.json = '';
        this.lastFileName = null;
        this.mode = 'paste';
      } catch (err) {
        this.setParseError('paste', 'Invalid JSON syntax');
        this.setItems('paste', []);
      }
    });
  }

  clear() {
    this.setItems(this.mode, []);
    this.setParseError(this.mode, null);
    if (this.mode === 'file') {
      this.lastFileName = null;
    }
  }

  toggleSelectAll(checked: boolean) {
    this.setAllSelected(this.mode, checked);
    this.currentItems.forEach(item => (item.selected = checked));
  }

  onItemSelectionChange(item: ImportItem, selected: boolean) {
    item.selected = selected;
    this.setAllSelected(this.mode, this.currentItems.every(i => i.selected));
  }

  onNameChange(item: ImportItem, name: string) {
    item.name = name;
    if (!name || !name.trim()) {
      item.error = 'Name cannot be empty';
    } else {
      if (item.original) {
        item.original.feature_name = name.trim();
      }
      item.error = this.validate(item.original);
    }
  }

  setDefaultBrowsers(item: ImportItem) {
    item.original.browsers = [DEFAULT_BROWSER];
    item.error = this.validate(item.original);
  }

  async importSelected() {
    const selected = this.currentItems.filter(i => i.selected);
    if (selected.length === 0) {
      this.snack.open('Nothing selected to import', 'OK');
      return;
    }

    const invalid = selected.find(i => !!i.error);
    if (invalid) {
      this.snack.open(`Fix errors before saving: ${invalid.error}`, 'OK');
      return;
    }

    this.busy = true;
    const createdIds: number[] = [];
    try {
      for (const it of selected) {
        const payload = this.toCreatePayload(it.original);
        const created = await this.api.createFeature(payload as any).toPromise();
        if (!created || !created.feature_id) {
          throw new Error('Unexpected response while creating feature');
        }
        createdIds.push(created.feature_id);
      }
      this.snack.open(`Imported ${createdIds.length} feature(s)`, 'OK');
    } catch (err: any) {
      for (const id of createdIds) {
        try {
          await this.api.deleteFeature(id).toPromise();
        } catch (_) {}
      }
      this.snack.open(`Import failed. Rolled back. ${err?.message || ''}`.trim(), 'OK', {
        duration: 6000,
      });
    } finally {
      this.busy = false;
    }
  }

  requiresBrowsers(obj: any): boolean {
    if (!obj) {
      return true;
    }
    const flag = obj.depends_on_others;
    return !(flag === true || flag === 'true' || flag === 1);
  }

  browsersLabel(item: ImportItem) {
    if (!this.requiresBrowsers(item.original)) {
      return 'Inherited';
    }
    const browsers = item.original?.browsers || [];
    if (!Array.isArray(browsers) || browsers.length === 0) return 'None';
    const first = browsers[0];
    const label = first.browser || 'Unknown';
    return browsers.length > 1 ? `${label} +${browsers.length - 1}` : label;
  }

  private populateFromJson(json: RawExport, target: ImportMode) {
    this.setParseError(target, null);
    const flat = this.flatten(json);
    if (flat.length === 0) {
      this.setParseError(target, 'No features found in the file');
      this.setItems(target, []);
      return;
    }

    const items: ImportItem[] = flat.map(feat => ({
      original: feat,
      selected: true,
      name: this.getName(feat),
      error: this.validate(feat),
    }));

    this.setItems(target, items);
  }

  private getName(obj: any): string {
    if (obj && obj.feature_name) return obj.feature_name;
    if (obj && obj.metadata && obj.metadata.feature_name) return obj.metadata.feature_name;
    return 'Unnamed';
  }

  private flatten(json: RawExport): any[] {
    if (Array.isArray(json)) {
      return json;
    }
    const rels: any[] = [];
    const walk = (folder: any) => {
      if (!folder) return;
      for (const f of folder.features || []) {
        if (f && f.metadata) {
          rels.push({ ...f.metadata, steps: f.steps });
        }
      }
      for (const sub of folder.folders || []) walk(sub);
    };
    if (json && json.folder) walk(json.folder);
    return rels;
  }

  private validate(obj: any): string | null {
    const required = [
      'feature_name',
      'app_id',
      'app_name',
      'environment_id',
      'environment_name',
      'department_id',
      'department_name',
      'cloud',
      'video',
    ];

    for (const key of required) {
      const value = obj[key];
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        return `Missing property: ${key}`;
      }
    }

    if (this.requiresBrowsers(obj) && (!Array.isArray(obj.browsers) || obj.browsers.length === 0)) {
      return 'Missing property: browsers';
    }

    if (!Array.isArray(obj.steps)) return 'Missing or invalid: steps';
    for (const step of obj.steps) {
      if (!('step_content' in step)) return 'Invalid steps: step_content missing';
    }

    return null;
  }

  private toCreatePayload(obj: any) {
    const needsBrowsers = this.requiresBrowsers(obj);
    return {
      feature_name: obj.feature_name,
      app_id: obj.app_id,
      app_name: obj.app_name,
      description: obj.description || '',
      environment_id: obj.environment_id,
      environment_name: obj.environment_name,
      steps: { steps_content: obj.steps || [] },
      department_id: obj.department_id,
      department_name: obj.department_name,
      screenshot: '',
      compare: '',
      depends_on_others: !!obj.depends_on_others,
      browsers: needsBrowsers
        ? obj.browsers && obj.browsers.length > 0
          ? obj.browsers
          : [DEFAULT_BROWSER]
        : [],
      cloud: obj.cloud || 'local',
      video: obj.video !== false,
      network_logging: !!obj.network_logging,
      generate_dataset: !!obj.generate_dataset,
      continue_on_failure: !!obj.continue_on_failure,
    };
  }

  private setItems(target: ImportMode, items: ImportItem[]) {
    if (target === 'file') {
      this.fileItems = items;
      this.fileAllSelected = items.every(i => i.selected);
    } else {
      this.pasteItems = items;
      this.pasteAllSelected = items.every(i => i.selected);
    }
  }

  private setParseError(target: ImportMode, error: string | null) {
    if (target === 'file') {
      this.fileParseError = error;
    } else {
      this.pasteParseError = error;
    }
  }

  private setAllSelected(target: ImportMode, value: boolean) {
    if (target === 'file') {
      this.fileAllSelected = value;
    } else {
      this.pasteAllSelected = value;
    }
  }
}

