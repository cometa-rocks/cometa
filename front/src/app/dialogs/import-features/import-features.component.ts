import { Component, ChangeDetectionStrategy, NgZone, ChangeDetectorRef, Inject, Optional } from '@angular/core';
import {
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
  MatLegacyDialog as MatDialog,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
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
import { Features } from '@store/actions/features.actions';
import { FeaturesState } from '@store/features.state';
import {
  AreYouSureDialog,
  AreYouSureData,
} from '@dialogs/are-you-sure/are-you-sure.component';

type ImportMode = 'file' | 'paste';
type RawExport = any;

interface FolderPathEntry {
  name: string;
  id: string | number | null;
}

export interface ImportItem {
  original: any;
  selected: boolean;
  name: string;
  error: string | null;
  folderPath: FolderPathEntry[];
}

export interface ImportStructureNode {
  id: string;
  name: string;
  features: ImportItem[];
  folders: ImportStructureNode[];
  collapsed: boolean;
  path: FolderPathEntry[];
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

interface ImportFeaturesDialogData {
  departmentId?: number;
}

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
    @Optional() @Inject(MAT_DIALOG_DATA) private dialogData: ImportFeaturesDialogData | null,
  ) {
    combineLatest([
      this.store.select<DepartmentSummary[] | null>(
        UserState.RetrieveUserDepartments
      ),
      this.store.select<FolderTreeNode[] | null>(
        CustomSelectors.GetDepartmentFolders()
      ),
    ])
      .pipe(untilDestroyed(this))
      .subscribe(([departments, trees]: [
        DepartmentSummary[] | null,
        FolderTreeNode[] | null,
      ]) => {
        this.departments = Array.isArray(departments) ? departments : [];
        this.departmentTrees = Array.isArray(trees) ? trees : [];

        if (this.dialogData?.departmentId) {
          const exists = this.departments.some(
            dept => dept.department_id === this.dialogData?.departmentId
          );
          if (exists) {
            this.selectedDepartmentId = this.dialogData.departmentId;
          }
        }

        if (
          this.selectedDepartmentId == null &&
          this.departments.length > 0
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
  maintainStructure = false;

  private fileItems: ImportItem[] = [];
  private pasteItems: ImportItem[] = [];
  private fileAllSelected = false;
  private pasteAllSelected = false;
  private fileParseError: string | null = null;
  private pasteParseError: string | null = null;
  treeRoot: ImportStructureNode | null = null;
  private folderIdCounter = 0;
  private featureKeyCounter = 0;

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
    const ref = this.dialog.open<ImportJSONComponent, undefined, boolean | undefined>(
      ImportJSONComponent,
      {
        width: '620px',
        autoFocus: true,
      }
    );

    const instance = ref.componentInstance;

    ref.afterClosed().subscribe(success => {
      if (!success || !instance) {
        return;
      }
      try {
        const json = JSON.parse(instance.json || '');
        this.populateFromJson(json, 'paste');
        instance.json = '';
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
    this.treeRoot = null;
    this.folderIdCounter = 0;
    this.featureKeyCounter = 0;
    if (this.mode === 'file') {
      this.lastFileName = null;
    }
  }

  // Bulk select/deselect helper wired to the master checkbox
  toggleSelectAll(checked: boolean) {
    this.setAllSelected(this.mode, checked);
    this.currentItems.forEach(item => (item.selected = checked));
    if (this.treeRoot) {
      this.setFolderSelection(this.treeRoot, checked);
      this.treeRoot = this.cloneTree(this.treeRoot);
    }
    this.refreshSelectAllState();
    this.cdr.markForCheck();
  }

  // Keeps the master checkbox in sync with row-level changes
  onItemSelectionChange(item: ImportItem, selected: boolean) {
    item.selected = selected;
    this.setAllSelected(this.mode, this.currentItems.every(i => i.selected));
    this.refreshSelectAllState();
    if (this.treeRoot) {
      this.treeRoot = this.cloneTree(this.treeRoot);
    }
    this.cdr.markForCheck();
  }

  onFolderSelectionChange(event: { node: ImportStructureNode; checked: boolean }) {
    if (!event?.node) {
      return;
    }
    this.setFolderSelection(event.node, event.checked);
    if (this.treeRoot) {
      this.treeRoot = this.cloneTree(this.treeRoot);
    }
    this.refreshSelectAllState();
    this.cdr.markForCheck();
  }

  onFolderCollapseChange(node: ImportStructureNode) {
    node.collapsed = !node.collapsed;
    if (this.treeRoot) {
      this.treeRoot = this.cloneTree(this.treeRoot);
    }
    this.cdr.markForCheck();
  }

  onMaintainStructureChange(enabled: boolean) {
    this.maintainStructure = enabled;
    this.cdr.markForCheck();
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

  private async confirmDuplicateImports(
    items: ImportItem[],
    departmentId: number,
    departmentName?: string,
  ): Promise<boolean> {
    let department = this.departments.find(
      dept => dept.department_id === departmentId
    );

    if (!department) {
      const snapshotDepartments =
        this.store.selectSnapshot(UserState.RetrieveUserDepartments) || [];
      department = snapshotDepartments.find(
        dept => dept.department_id === departmentId
      );
    }

    const shouldValidate =
      department?.settings?.validate_duplicate_feature_names !== false;

    if (!shouldValidate) {
      return true;
    }

    const existingFeatures =
      this.store.selectSnapshot(FeaturesState.GetFeaturesAsArray) || [];
    const existingNames = new Set(
      existingFeatures
        .filter(feature => feature.department_id === departmentId)
        .map(feature => (feature.feature_name || '').trim().toLowerCase())
        .filter(name => !!name)
    );

    if (!existingNames.size) {
      return true;
    }

    const duplicates = new Map<string, string>();

    for (const item of items) {
      const rawName = (item.original?.feature_name || item.name || '').trim();
      if (!rawName) {
        continue;
      }
      const lowerName = rawName.toLowerCase();
      if (existingNames.has(lowerName) && !duplicates.has(lowerName)) {
        duplicates.set(lowerName, rawName);
      }
    }

    if (duplicates.size === 0) {
      return true;
    }

    const names = Array.from(duplicates.values());
    const deptLabel = department?.department_name || departmentName || 'this department';
    const description =
      names.length === 1
        ? `A feature named "${names[0]}" already exists in "${deptLabel}". Do you want to import it anyway?`
        : `The following feature names already exist in "${deptLabel}": ${names.join(', ')}. Do you want to import them anyway?`;

    const dialogRef = this.dialog.open<AreYouSureDialog, AreYouSureData, boolean>(
      AreYouSureDialog,
      {
        data: {
          title: 'Duplicate Feature Name',
          description,
        },
        autoFocus: true,
        minWidth: '420px',
      }
    );

    const result = await dialogRef.afterClosed().toPromise();
    return !!result;
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
    const targetDepartment = this.departments.find(
      dept => dept.department_id === targetDepartmentId
    );
    const targetDepartmentName =
      targetDepartment?.department_name ||
      selected[0].original?.department_name;

    let folderLookup: FolderLookupContext | null = null;
    const baseFolderId = this.selectedFolderId > 0 ? this.selectedFolderId : null;

    if (this.maintainStructure) {
      try {
        await this.store.dispatch(new Features.GetFolders()).toPromise();
      } catch (_) {}
      folderLookup = this.buildFolderLookup(targetDepartmentId);
      if (baseFolderId && (!folderLookup.byId.has(baseFolderId))) {
        try {
          await this.store.dispatch(new Features.GetFolders()).toPromise();
        } catch (_) {}
        folderLookup = this.buildFolderLookup(targetDepartmentId);
      }
    }

    const proceed = await this.confirmDuplicateImports(
      selected,
      targetDepartmentId,
      targetDepartmentName,
    );

    if (!proceed) {
      return;
    }

    this.busy = true;
    this.cdr.markForCheck();
    const createdIds: number[] = [];
    const createdFeatures: any[] = [];
    try {
      for (const it of selected) {
        const payload = this.toCreatePayload(
          it.original,
          targetDepartmentId,
          targetDepartmentName
        );
        const created = (await this.api.createFeature(payload as any).toPromise()) as any;

        if (created?.success === false) {
          const message = created?.error || created?.message || 'Feature import failed.';
          this.snack.open(message, 'OK');
          throw new Error(message);
        }

        if (!created || created.feature_id == null) {
          throw new Error('Unexpected response while creating feature');
        }

        createdIds.push(created.feature_id);
        createdFeatures.push(created);
        let destinationFolderId: number | null = null;

        if (this.maintainStructure) {
          if (!folderLookup) {
            folderLookup = this.buildFolderLookup(targetDepartmentId);
          }
          const ensureResult = await this.ensureFolderPath(
            it.folderPath,
            targetDepartmentId,
            baseFolderId,
            folderLookup,
            it.original?.department_name,
          );
          destinationFolderId = ensureResult.folderId;
          folderLookup = ensureResult.lookup;
        } else if (baseFolderId) {
          destinationFolderId = baseFolderId;
        }

        if (destinationFolderId) {
          await this.api
            .moveFeatureFolder(0, destinationFolderId, created.feature_id, targetDepartmentId)
            .toPromise();
        }
      }
      if (createdFeatures.length > 0) {
        await this.store.dispatch(new Features.SetFeatureInfo(createdFeatures)).toPromise();
      }
      await this.store.dispatch(new Features.GetFolders()).toPromise();
      try {
        await this.store.dispatch(new Features.GetFeatures()).toPromise();
      } catch (_) {}

      try {
        const currentRoute = this.store.snapshot().features.currentRouteNew || [];
        if (Array.isArray(currentRoute) && currentRoute.length > 0) {
          const clonedRoute = currentRoute.map(folder => {
            const entry: any = { ...folder };
            if ('route' in entry) {
              delete entry.route;
            }
            return entry;
          });
          await this.store
            .dispatch(new Features.ReturnToFolderRoute(0))
            .toPromise();
          await this.store
            .dispatch(new Features.SetFolderRoute(clonedRoute))
            .toPromise();
        }
      } catch (_) {}

      this.snack.open(`Imported ${createdIds.length} feature(s)`, 'OK');
      this.dialogRef.close({ imported: createdIds.length });
      return;
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

  browserTooltip(item: ImportItem): string | null {
    const list = item.original?.browsers;
    if (!Array.isArray(list) || list.length <= 1) {
      return null;
    }
    const formatted = list.map(browser => {
      const name = browser?.browser || 'Unknown';
      const version = browser?.browser_version;
      return version ? `${name} (${version})` : name;
    });
    return formatted.join('\n');
  }

  // Normalises the JSON export and stores it for the chosen mode
  private populateFromJson(json: RawExport, target: ImportMode) {
    this.setParseError(target, null);
    this.treeRoot = null;

    const structure = this.extractStructure(json);
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
      folderPath: [],
    }));

    this.setItems(target, items);

    let root: ImportStructureNode | null = null;

    if (structure) {
      const idBuckets = new Map<string, ImportItem[]>();
      const signatureBuckets = new Map<string, ImportItem[]>();

      items.forEach(item => {
        const idKey = this.getFeatureIdKey(item.original);
        if (idKey) {
          const bucket = idBuckets.get(idKey) || [];
          bucket.push(item);
          idBuckets.set(idKey, bucket);
        } else {
          const signature = this.buildFeatureSignature(item.original);
          const bucket = signatureBuckets.get(signature) || [];
          bucket.push(item);
          signatureBuckets.set(signature, bucket);
        }
      });

      this.folderIdCounter = 0;
      this.featureKeyCounter = 0;
      const initialEntry = this.toPathEntry(structure);
      root = this.buildStructureTree(
        structure,
        idBuckets,
        signatureBuckets,
        0,
        initialEntry ? [initialEntry] : [],
      );

      const leftovers: ImportItem[] = [];
      idBuckets.forEach(bucket => leftovers.push(...bucket));
      signatureBuckets.forEach(bucket => leftovers.push(...bucket));
      if (leftovers.length) {
        if (root) {
          const fallbackPath = root.path ? root.path.map(entry => ({ ...entry })) : [];
          leftovers.forEach(item => {
            item.folderPath = fallbackPath.map(entry => ({ ...entry }));
          });
          root.features = [...root.features, ...leftovers];
        } else {
          root = this.buildFlatRoot(leftovers);
        }
      }
    }

    const finalRoot = root ?? this.buildFlatRoot(items);
    this.treeRoot = this.cloneTree(finalRoot);
    this.refreshSelectAllState();
    this.syncMaintainStructureFlag();
    this.cdr.markForCheck();
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

  private extractStructure(json: RawExport): any | null {
    if (!json || Array.isArray(json)) {
      return null;
    }
    if (json.folder) {
      try {
        return JSON.parse(JSON.stringify(json.folder));
      } catch (_) {
        return json.folder;
      }
    }
    return null;
  }

  private setFolderSelection(node: ImportStructureNode, checked: boolean) {
    (node.features || []).forEach(item => {
      item.selected = checked;
    });
    (node.folders || []).forEach(child => this.setFolderSelection(child, checked));
  }

  private refreshSelectAllState() {
    this.fileAllSelected = this.fileItems.length > 0 && this.fileItems.every(i => i.selected);
    this.pasteAllSelected = this.pasteItems.length > 0 && this.pasteItems.every(i => i.selected);
    this.syncMaintainStructureFlag();
  }

  private buildStructureTree(
    folder: any,
    idBuckets: Map<string, ImportItem[]>,
    signatureBuckets: Map<string, ImportItem[]>,
    depth: number,
    path: FolderPathEntry[]
  ): ImportStructureNode {
    const currentPath = path.map(entry => ({ ...entry }));
    const idValue =
      folder?.id ??
      folder?.folder_id ??
      (folder?.name ? `folder-${folder.name}` : this.nextFolderId());

    const features: ImportItem[] = [];
    const rawFeatures = Array.isArray(folder?.features) ? folder.features : [];
    for (const feat of rawFeatures) {
      const item = this.takeFeatureFromBuckets(feat?.metadata ?? feat, idBuckets, signatureBuckets);
      if (item) {
        item.folderPath = currentPath.map(entry => ({ ...entry }));
        features.push(item);
      }
    }

    const childFolders = Array.isArray(folder?.folders) ? folder.folders : [];

    return {
      id: String(idValue),
      name: folder?.name || 'Unnamed folder',
      features,
      folders: childFolders.map((child: any) => {
        const entry = this.toPathEntry(child);
        const nextPath = [...currentPath];
        if (entry) {
          nextPath.push(entry);
        }
        return this.buildStructureTree(child, idBuckets, signatureBuckets, depth + 1, nextPath);
      }),
      collapsed: false,
      path: currentPath,
    };
  }

  private getFeatureIdKey(meta: any): string | null {
    const source = meta?.metadata ?? meta;
    if (!source) return null;
    const id = source.feature_id ?? source.id;
    if (id === undefined || id === null) {
      return null;
    }
    return String(id);
  }

  private buildFeatureSignature(meta: any): string {
    const source = meta?.metadata ?? meta;
    const name = source?.feature_name ?? source?.name ?? 'feature';
    const app = source?.app_id ?? source?.app ?? '';
    const env = source?.environment_id ?? source?.environment ?? '';
    const stepCount = Array.isArray(source?.steps) ? source.steps.length : 0;
    return `${name}|app:${app}|env:${env}|steps:${stepCount}`;
  }

  private takeFeatureFromBuckets(
    meta: any,
    idBuckets: Map<string, ImportItem[]>,
    signatureBuckets: Map<string, ImportItem[]>
  ): ImportItem | null {
    const idKey = this.getFeatureIdKey(meta);
    if (idKey && idBuckets.has(idKey)) {
      const bucket = idBuckets.get(idKey)!;
      const item = bucket.shift() || null;
      if (!bucket.length) {
        idBuckets.delete(idKey);
      }
      if (item) {
        return item;
      }
    }

    const signature = this.buildFeatureSignature(meta);
    if (signatureBuckets.has(signature)) {
      const bucket = signatureBuckets.get(signature)!;
      const item = bucket.shift() || null;
      if (!bucket.length) {
        signatureBuckets.delete(signature);
      }
      if (item) {
        return item;
      }
    }

    return null;
  }

  private buildFlatRoot(items: ImportItem[]): ImportStructureNode {
    items.forEach(item => {
      item.folderPath = [];
    });

    return {
      id: 'root',
      name: 'Imported features',
      collapsed: false,
      features: items,
      folders: [],
      path: [],
    };
  }

  private cloneTree(node: ImportStructureNode): ImportStructureNode {
    return {
      id: node.id,
      name: node.name,
      collapsed: node.collapsed,
      features: [...node.features],
      folders: node.folders.map(child => this.cloneTree(child)),
      path: node.path.map(entry => ({ ...entry })),
    };
  }

  private toPathEntry(source: any): FolderPathEntry | null {
    if (!source) {
      return null;
    }
    const name = typeof source.name === 'string' ? source.name : null;
    if (!name) {
      return null;
    }
    const idValue = source.id ?? source.folder_id;
    return {
      name,
      id: idValue !== undefined ? idValue : null,
    };
  }

  private buildFolderLookup(departmentId: number): FolderLookupContext {
    const byParentAndName = new Map<string, FolderCacheEntry>();
    const byId = new Map<number, FolderCacheEntry>();

    const tree = this.departmentTrees.find(node => node.department === departmentId);
    const visit = (folders: FolderTreeNode[] | undefined, parentId: number | null) => {
      if (!Array.isArray(folders)) {
        return;
      }
      for (const folder of folders) {
        if (!folder) {
          continue;
        }
        const entry: FolderCacheEntry = {
          id: folder.folder_id,
          name: folder.name || 'Unnamed folder',
          parentId,
          departmentId,
        };
        byId.set(entry.id, entry);
        byParentAndName.set(this.folderKey(parentId, entry.name), entry);
        visit(folder.folders, entry.id);
      }
    };

    visit(tree?.folders, null);

    return {
      byParentAndName,
      byId,
    };
  }

  private folderKey(parentId: number | null, name: string): string {
    return `${parentId ?? 0}::${name.trim().toLowerCase()}`;
  }

  private normalizePathForBase(
    path: FolderPathEntry[],
    baseFolderId: number | null,
    lookup: FolderLookupContext,
    sourceDepartmentName?: string,
  ): FolderPathEntry[] {
    const cleaned = path
      .filter(segment => segment && typeof segment.name === 'string' && segment.name.trim().length)
      .map(segment => ({
        name: segment.name.trim(),
        id: segment.id ?? null,
      }));

    if (!baseFolderId) {
      if (
        cleaned.length > 0 &&
        sourceDepartmentName &&
        cleaned[0].name.trim().toLowerCase() === sourceDepartmentName.trim().toLowerCase()
      ) {
        cleaned.shift();
      }
      return cleaned;
    }

    const baseEntry = lookup.byId.get(baseFolderId);
    if (!baseEntry) {
      return cleaned;
    }

    const baseName = baseEntry.name.trim().toLowerCase();
    const index = cleaned.findIndex(segment => segment.name.trim().toLowerCase() === baseName);
    if (index >= 0) {
      return cleaned.slice(index + 1);
    }

    return cleaned;
  }

  private async ensureFolderPath(
    path: FolderPathEntry[],
    departmentId: number,
    baseFolderId: number | null,
    lookup: FolderLookupContext,
    sourceDepartmentName?: string,
  ): Promise<{ folderId: number | null; lookup: FolderLookupContext }> {
    const normalizedPath = this.normalizePathForBase(
      path,
      baseFolderId,
      lookup,
      sourceDepartmentName,
    );
    if (normalizedPath.length === 0) {
      return { folderId: baseFolderId, lookup };
    }

    let currentParent = baseFolderId;
    let currentLookup = lookup;

    for (const segment of normalizedPath) {
      const key = this.folderKey(currentParent, segment.name);
      let entry = currentLookup.byParentAndName.get(key);

      if (!entry) {
        const response = await this.api
          .createFolder(segment.name, departmentId, currentParent ?? 0)
          .toPromise();

        if (!response?.success) {
          throw new Error(response?.error || `Unable to create folder "${segment.name}"`);
        }

        const createdFolder = response.folder;
        if (!createdFolder?.folder_id) {
          try {
            await this.store.dispatch(new Features.GetFolders()).toPromise();
          } catch (_) {}
          currentLookup = this.buildFolderLookup(departmentId);
          entry = currentLookup.byParentAndName.get(key);
          if (!entry) {
            throw new Error(`Folder "${segment.name}" could not be located after creation.`);
          }
        } else {
          entry = {
            id: createdFolder.folder_id,
            name: createdFolder.name,
            parentId: createdFolder.parent_id,
            departmentId: createdFolder.department_id,
          };
          currentLookup.byId.set(entry.id, entry);
          currentLookup.byParentAndName.set(key, entry);
        }
      }

      currentParent = entry.id;
    }

    return { folderId: currentParent, lookup: currentLookup };
  }

  private nextFolderId(): string {
    return `folder-${this.folderIdCounter++}`;
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
    const toInt = (value: any, fallback: number = 0) => {
      const parsed = parseInt(value as any, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const emailAddresses = Array.isArray(obj.email_address) ? obj.email_address : [];
    const emailCc = Array.isArray(obj.email_cc_address) ? obj.email_cc_address : [];
    const emailBcc = Array.isArray(obj.email_bcc_address) ? obj.email_bcc_address : [];

    const payload: any = {
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
      mobiles: Array.isArray(obj.mobiles) ? obj.mobiles : [],
      need_help: !!obj.need_help,
      send_mail: !!obj.send_mail,
      send_mail_on_error: !!obj.send_mail_on_error,
      check_maximum_notification_on_error: !!obj.check_maximum_notification_on_error,
      maximum_notification_on_error: toInt(obj.maximum_notification_on_error, 0),
      attach_pdf_report_to_email:
        obj.attach_pdf_report_to_email === undefined ? true : !!obj.attach_pdf_report_to_email,
      do_not_use_default_template: !!obj.do_not_use_default_template,
      email_address: emailAddresses,
      email_cc_address: emailCc,
      email_bcc_address: emailBcc,
      email_subject: obj.email_subject || '',
      email_body: obj.email_body || '',
      send_telegram_notification: !!obj.send_telegram_notification,
    };

    if (obj.telegram_options) {
      const {
        id: _ignoreId,
        feature: _ignoreFeature,
        created_on: _ignoreCreated,
        updated_on: _ignoreUpdated,
        number_notification_sent_telegram: _ignoreSent,
        ...rest
      } = obj.telegram_options;

      if (Object.keys(rest).length > 0) {
        payload.telegram_options = rest;
      }
    }

    return payload;
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
    this.refreshSelectAllState();
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

  private syncMaintainStructureFlag() {
    const hasStructure = !!this.treeRoot && (
      (Array.isArray(this.treeRoot.folders) && this.treeRoot.folders.length > 0) ||
      (Array.isArray(this.treeRoot.features) && this.treeRoot.features.some(item => item.folderPath.length > 0))
    );

    if (!hasStructure && this.maintainStructure) {
      this.maintainStructure = false;
    }
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
  settings?: any;
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

interface FolderLookupContext {
  byParentAndName: Map<string, FolderCacheEntry>;
  byId: Map<number, FolderCacheEntry>;
}

interface FolderCacheEntry {
  id: number;
  name: string;
  parentId: number | null;
  departmentId: number;
}
