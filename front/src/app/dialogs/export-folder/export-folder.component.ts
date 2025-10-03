import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
  OnInit,
} from '@angular/core';
import {
  MatLegacyDialogModule,
  MatLegacyDialogRef as MatDialogRef,
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
} from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { NgFor, NgIf } from '@angular/common';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

import { ApiService } from '@services/api.service';
import { exportToJSONFile } from 'ngx-amvara-toolbox';

interface ExportFolderDialogData {
  mode: 'folder' | 'department';
  folder?: Folder;
  department?: Folder;
}

interface FeatureNode {
  source: any;
  parent: FolderNode;
  checked: boolean;
  name: string;
  featureId: number | null;
}

interface FolderNode {
  source: any;
  parent: FolderNode | null;
  depth: number;
  checked: boolean;
  indeterminate: boolean;
  collapsed: boolean;
  name: string;
  folders: FolderNode[];
  features: FeatureNode[];
}

@Component({
  selector: 'cometa-export-folder-dialog',
  templateUrl: './export-folder.component.html',
  styleUrls: ['./export-folder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    MatLegacyDialogModule,
    MatLegacyButtonModule,
    MatLegacyCheckboxModule,
    MatLegacyProgressSpinnerModule,
    MatDividerModule,
    MatIconModule,
  ],
})
export class ExportFolderDialogComponent implements OnInit {
  loading = true;
  error: string | null = null;
  rootNode: FolderNode | null = null;
  originalPayload: any;
  exportFileName = 'folder_export.json';

  constructor(
    private dialogRef: MatDialogRef<ExportFolderDialogComponent>,
    private api: ApiService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) private data: ExportFolderDialogData,
  ) {}

  ngOnInit() {
    if (this.data.mode === 'folder' && this.data.folder?.folder_id) {
      this.exportFileName = this.buildFileName('folder', this.data.folder.name || 'folder');
      this.api.getFolderFeatureExport(this.data.folder.folder_id).subscribe({
        next: response => this.handlePayload(response),
        error: err => this.handleError(err),
      });
    } else if (this.data.mode === 'department' && (this.data.department?.department || this.data.department?.folder_id)) {
      const departmentId = this.data.department?.department ?? this.data.department?.folder_id;
      this.exportFileName = this.buildFileName('department', this.data.department?.name || 'department');
      this.api.getDepartmentFeatureExport(departmentId as number).subscribe({
        next: response => this.handlePayload(response),
        error: err => this.handleError(err),
      });
    } else {
      this.handleError(new Error('Invalid export request'));
    }
  }

  get selectedCount(): number {
    if (!this.rootNode) return 0;
    return this.countSelected(this.rootNode);
  }

  get totalCount(): number {
    if (!this.rootNode) return 0;
    return this.countTotal(this.rootNode);
  }

  close() {
    this.dialogRef.close();
  }

  toggleFolder(folder: FolderNode, checked: boolean) {
    this.setFolderState(folder, checked);
    this.updateAncestors(folder.parent);
  }

  toggleCollapse(folder: FolderNode, event: MouseEvent) {
    event.stopPropagation();
    folder.collapsed = !folder.collapsed;
    this.cdr.markForCheck();
  }

  toggleFeature(feature: FeatureNode, checked: boolean) {
    feature.checked = checked;
    this.updateAncestors(feature.parent);
  }

  exportSelection() {
    if (!this.rootNode || !this.originalPayload) {
      return;
    }

    const { folder, count } = this.serializeFolder(this.rootNode);
    if (!folder || count === 0) {
      this.snack.open('Select at least one feature to export', 'OK', {
        duration: 3000,
      });
      return;
    }

    const payload = {
      ...this.originalPayload,
      feature_count: count,
      folder,
    };

    exportToJSONFile(this.exportFileName, payload);
    this.snack.open(`Exported ${count} feature${count === 1 ? '' : 's'}`, 'OK', {
      duration: 3000,
    });
    this.dialogRef.close();
  }

  private handlePayload(response: any) {
    this.originalPayload = response;
    this.rootNode = this.buildFolderNode(response.folder, null, 0);
    this.loading = false;
    this.cdr.markForCheck();
  }

  private handleError(err: any) {
    this.error = err?.message || 'Unable to load export data';
    this.loading = false;
    this.cdr.markForCheck();
  }

  private buildFileName(prefix: string, name: string): string {
    const sanitized = (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const base = sanitized ? `${prefix}_${sanitized}_export` : `${prefix}_export`;
    return `${base}.json`;
  }

  private buildFolderNode(source: any, parent: FolderNode | null, depth: number): FolderNode {
    const node: FolderNode = {
      source,
      parent,
      depth,
      checked: true,
      indeterminate: false,
      collapsed: false,
      name: source?.name || 'Unnamed folder',
      folders: [],
      features: [],
    };

    const features: any[] = Array.isArray(source?.features) ? source.features : [];
    node.features = features.map(feature => {
      const metadata = feature?.metadata || {};
      return {
        source: feature,
        parent: node,
        checked: true,
        name: metadata.feature_name || 'Unnamed feature',
        featureId: metadata.feature_id ?? null,
      } as FeatureNode;
    });

    const folders: any[] = Array.isArray(source?.folders) ? source.folders : [];
    node.folders = folders.map(child => this.buildFolderNode(child, node, depth + 1));

    return node;
  }

  private setFolderState(folder: FolderNode, checked: boolean) {
    folder.checked = checked;
    folder.indeterminate = false;
    folder.features.forEach(feature => (feature.checked = checked));
    folder.folders.forEach(child => this.setFolderState(child, checked));
  }

  private updateAncestors(folder: FolderNode | null) {
    if (!folder) {
      return;
    }

    const totalFeatures = folder.features.length;
    const checkedFeatures = folder.features.filter(f => f.checked).length;
    const totalFolders = folder.folders.length;
    const allFoldersChecked = folder.folders.every(child => child.checked && !child.indeterminate);
    const allFoldersUnchecked = folder.folders.every(child => !child.checked && !child.indeterminate);

    const featuresAllChecked = totalFeatures === 0 ? true : checkedFeatures === totalFeatures;
    const featuresAllUnchecked = totalFeatures === 0 ? true : checkedFeatures === 0;

    folder.checked = featuresAllChecked && allFoldersChecked && (totalFeatures + totalFolders > 0);
    folder.indeterminate = !folder.checked && !(featuresAllUnchecked && allFoldersUnchecked);

    this.updateAncestors(folder.parent);
  }

  private serializeFolder(folder: FolderNode): { folder: any | null; count: number } {
    const selectedFeatures = folder.features
      .filter(feature => feature.checked)
      .map(feature => JSON.parse(JSON.stringify(feature.source)));

    let totalCount = selectedFeatures.length;

    const selectedFolders = folder.folders
      .map(child => this.serializeFolder(child))
      .filter(child => child.folder !== null);

    const serializedChildFolders = selectedFolders.map(child => {
      totalCount += child.count;
      return child.folder;
    });

    if (selectedFeatures.length === 0 && serializedChildFolders.length === 0) {
      return { folder: null, count: 0 };
    }

    const folderClone = JSON.parse(JSON.stringify(folder.source));
    folderClone.features = selectedFeatures;
    folderClone.folders = serializedChildFolders;

    return { folder: folderClone, count: totalCount };
  }

  private countSelected(folder: FolderNode): number {
    const features = folder.features.filter(feature => feature.checked).length;
    const nested = folder.folders.reduce((sum, child) => sum + this.countSelected(child), 0);
    return features + nested;
  }

  private countTotal(folder: FolderNode): number {
    const features = folder.features.length;
    const nested = folder.folders.reduce((sum, child) => sum + this.countTotal(child), 0);
    return features + nested;
  }
}
