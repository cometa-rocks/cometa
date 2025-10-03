import { Component, ChangeDetectionStrategy, NgZone, ChangeDetectorRef } from '@angular/core';
import {
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialog as MatDialog,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacySelectModule } from '@angular/material/legacy-select';
import { MatLegacyOptionModule } from '@angular/material/legacy-core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

import { ApiService } from '@services/api.service';
import { ImportJSONComponent } from '@dialogs/import-json/import-json.component';
import { ImportFeaturesTableComponent } from './import-features-table/import-features-table.component';
import { LogService } from '@services/log.service';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';
import { CustomSelectors } from '@others/custom-selectors';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';

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

@UntilDestroy()
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
    MatLegacyFormFieldModule,
    MatLegacySelectModule,
    MatLegacyOptionModule,
    FormsModule,
    NgIf,
    NgFor,
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
    private log: LogService,
    private store: Store,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    combineLatest([
      this.store.select(UserState.RetrieveUserDepartments),
      this.store.select(CustomSelectors.GetDepartmentFolders()),
    ])
      .pipe(untilDestroyed(this))
      .subscribe(([departments, trees]) => {
        this.departments = departments || [];
        this.departmentTrees = trees || [];

        if (
          this.departments.length > 0 &&
          !this.departments.some(dept => dept.department_id === this.selectedDepartmentId)
        ) {
          this.selectedDepartmentId = this.departments[0].department_id;
        }

        this.updateFolderOptions();
        this.cdr.markForCheck();
      });
  }

  busy = false;
  mode: ImportMode = 'file';
  lastFileName: string | null = null;

  departments: DepartmentSummary[] = [];
  private departmentTrees: FolderTreeNode[] = [];
  selectedDepartmentId: number | null = null;
  folderOptions: FolderOption[] = [];
  selectedFolderId = 0;

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

  // True when the active mode already has at least one candidate ready and a destination
  get hasItems(): boolean {
    return this.currentItems.length > 0 && !!this.selectedDepartmentId;
  }

  // Switches between upload and paste view without clearing stored data
  setMode(mode: ImportMode) {
    this.mode = mode;
  }

  // Closes the dialog without importing anything
  handleCancel() {
    this.dialogRef.close();
  }

  onDepartmentChange(departmentId: number) {
    this.selectedDepartmentId = departmentId;
    this.selectedFolderId = 0;
    this.updateFolderOptions();
  }

  // Handles JSON uploads coming from the file input
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.lastFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.zone.run(() => {
        try {
          const json = JSON.parse(String(reader.result || 'null')) as RawExport;
          this.populateFromJson(json, 'file');
          this.mode = 'file';
          this.cdr.markForCheck();
        } catch (err) {
          this.setParseError('file', 'Invalid JSON');
          this.setItems('file', []);
          this.log.msg('2', 'Import features file parsing failed', 'import-features', err);
          this.cdr.markForCheck();
        }
      });
    };
    reader.readAsText(file);
  }

  // Opens the raw JSON dialog so users can paste exports from the clipboard
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
        this.cdr.markForCheck();
      } catch (err) {
        this.setParseError('paste', 'Invalid JSON syntax');
        this.setItems('paste', []);
        this.log.msg('2', 'Import features paste parsing failed', 'import-features', err);
        this.cdr.markForCheck();
      }
    });
  }

  // Clears whichever data set (file or paste) is currently active
  clear() {
    this.setItems(this.mode, []);
    this.setParseError(this.mode, null);
    if (this.mode === 'file') {
      this.lastFileName = null;
    }
  }

  // Bulk select/deselect helper wired to the master checkbox
  toggleSelectAll(checked: boolean) {
    this.setAllSelected(this.mode, checked);
    this.currentItems.forEach(item => (item.selected = checked));
  }

  // Keeps the master checkbox in sync with row-level changes
  onItemSelectionChange(item: ImportItem, selected: boolean) {
    item.selected = selected;
    this.setAllSelected(this.mode, this.currentItems.every(i => i.selected));
  }

  // Updates the feature name inline and triggers revalidation
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

  // Assigns the default local Chrome definition when exporters omit browsers
  setDefaultBrowsers(item: ImportItem) {
    item.original.browsers = [DEFAULT_BROWSER];
    item.error = this.validate(item.original);
  }

  // Saves the selected features; rolls back the batch if any create fails
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

    if (!this.selectedDepartmentId) {
      this.snack.open('Select a destination department', 'OK');
      return;
    }

    const targetDepartmentId = this.selectedDepartmentId;
    const targetDepartmentName =
      this.departments.find(dept => dept.department_id === targetDepartmentId)?.department_name ||
      selected[0].original?.department_name;

    this.busy = true;
    const createdIds: number[] = [];
    try {
      for (const it of selected) {
        const payload = this.toCreatePayload(
          it.original,
          targetDepartmentId,
          targetDepartmentName
        );
        const created = await this.api.createFeature(payload as any).toPromise();
        if (!created || !created.feature_id) {
          throw new Error('Unexpected response while creating feature');
        }
        createdIds.push(created.feature_id);
        if (this.selectedFolderId) {
          await this.api
            .moveFeatureFolder(0, this.selectedFolderId, created.feature_id, targetDepartmentId)
            .toPromise();
        }
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
      this.log.msg('2', 'Import features transaction failed, rolled back', 'import-features', err);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  // Determines whether browsers must be enforced (standalone) or inherited
  requiresBrowsers(obj: any): boolean {
    if (!obj) {
      return true;
    }
    const flag = obj.depends_on_others;
    return !(flag === true || flag === 'true' || flag === 1);
  }

  // Formats the browser column label used by the table component
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

  // Normalises the JSON export and stores it for the chosen mode
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

  // Extracts a display name whether the export is flat or nested
  private getName(obj: any): string {
    const featureName = obj.feature_name ?? obj.metadata?.feature_name;
    return featureName ? featureName : 'Unnamed';
  }

  // Converts folder exports into a simple array of feature metadata + steps
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

  // Performs validation checks and returns a short error string when needed
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

  // Shapes the payload expected by the backend create feature endpoint
  private toCreatePayload(obj: any, departmentId: number, departmentName: string) {
    const needsBrowsers = this.requiresBrowsers(obj);
    return {
      feature_name: obj.feature_name,
      app_id: obj.app_id,
      app_name: obj.app_name,
      description: obj.description || '',
      environment_id: obj.environment_id,
      environment_name: obj.environment_name,
      steps: { steps_content: obj.steps || [] },
      department_id: departmentId,
      department_name: departmentName,
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

  // Stores mode-specific items while keeping the master checkbox state fresh
  private setItems(target: ImportMode, items: ImportItem[]) {
    if (target === 'file') {
      this.fileItems = items;
      this.fileAllSelected = items.every(i => i.selected);
    } else {
      this.pasteItems = items;
      this.pasteAllSelected = items.every(i => i.selected);
    }
  }

  // Persists validation errors for the correct import mode
  private setParseError(target: ImportMode, error: string | null) {
    if (target === 'file') {
      this.fileParseError = error;
    } else {
      this.pasteParseError = error;
    }
  }

  // Tracks the bulk selection state independently for each mode
  private setAllSelected(target: ImportMode, value: boolean) {
    if (target === 'file') {
      this.fileAllSelected = value;
    } else {
      this.pasteAllSelected = value;
    }
  }

  private updateFolderOptions() {
    if (!this.selectedDepartmentId) {
      this.folderOptions = [];
      this.selectedFolderId = 0;
      return;
    }

    const tree = this.departmentTrees.find(
      item => item.department === this.selectedDepartmentId
    );
    const nestedFolders = tree?.folders || [];
    const flattened = this.flattenFolderTree(nestedFolders);
    this.folderOptions = flattened;

    if (!this.folderOptions.some(option => option.id === this.selectedFolderId)) {
      this.selectedFolderId = 0;
    }
    this.cdr.markForCheck();
  }

  private flattenFolderTree(folders: FolderTreeNode[], parentPath: string = ''): FolderOption[] {
    if (!folders || folders.length === 0) {
      return [];
    }

    const options: FolderOption[] = [];

    folders.forEach(folder => {
      const label = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
      options.push({ id: folder.folder_id, label });

      const children = folder.folders || [];
      if (children.length > 0) {
        options.push(...this.flattenFolderTree(children, label));
      }
    });

    return options;
  }

}

interface DepartmentSummary {
  department_id: number;
  department_name: string;
}

interface FolderTreeNode {
  folder_id: number;
  name: string;
  department?: number;
  folders?: FolderTreeNode[];
}

interface FolderOption {
  id: number;
  label: string;
}
