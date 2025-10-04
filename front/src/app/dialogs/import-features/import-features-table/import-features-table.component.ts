import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ImportItem } from '../import-features.component';
import type { ImportStructureNode } from '../import-features.component';
interface TableRowBase {
  type: 'feature' | 'folder';
  depth: number;
}

interface TableRowFeature extends TableRowBase {
  type: 'feature';
  item: ImportItem;
  stepCount: number;
}

interface TableRowFolder extends TableRowBase {
  type: 'folder';
  node: ImportStructureNode;
  checked: boolean;
  indeterminate: boolean;
  collapsed: boolean;
  featureCount: number;
  selectedCount: number;
  stepCount: number;
}

type TableRow = TableRowFeature | TableRowFolder;

interface FolderStats {
  totalFeatures: number;
  selectedFeatures: number;
  totalSteps: number;
}

@Component({
  selector: 'cometa-import-features-table',
  templateUrl: './import-features-table.component.html',
  styleUrls: ['./import-features-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatLegacyCheckboxModule,
    MatLegacyInputModule,
    MatLegacyButtonModule,
    MatIconModule,
    MatTooltipModule,
    FormsModule,
    NgIf,
    NgFor,
    NgSwitch,
    NgSwitchCase,
    NgSwitchDefault,
  ],
})
export class ImportFeaturesTableComponent implements OnChanges {
  @Input() items: ImportItem[] = [];
  @Input() allSelected = false;
  @Input() maintainStructure = false;
  @Input() browsersLabel!: (item: ImportItem) => string;
  @Input() requiresBrowsers!: (original: any) => boolean;
  @Input() browserTooltip!: (item: ImportItem) => string | null;
  @Input() treeRoot: ImportStructureNode | null = null;

  @Output() selectAllChange = new EventEmitter<boolean>();
  @Output() maintainStructureChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<{ item: ImportItem; selected: boolean }>();
  @Output() nameChange = new EventEmitter<{ item: ImportItem; name: string }>();
  @Output() addDefaultBrowsers = new EventEmitter<ImportItem>();
  @Output() folderSelectionChange = new EventEmitter<{ node: ImportStructureNode; checked: boolean }>();
  @Output() folderCollapseChange = new EventEmitter<ImportStructureNode>();

  rows: TableRow[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if ('items' in changes || 'treeRoot' in changes || 'allSelected' in changes) {
      this.buildRows();
    }

    if (this.maintainStructure && !this.structureAvailable) {
      Promise.resolve().then(() => this.maintainStructureChange.emit(false));
    }
  }

  trackByRowIndex = (index: number, row: TableRow) =>
    row.type === 'folder'
      ? row.node.id ?? index
      : row.item.original?.feature_id ?? row.item.original?.metadata?.feature_id ?? index;

  private buildRows(): void {
    if (this.treeRoot) {
      this.rows = this.buildFolderRows(this.treeRoot, 0).rows;
    } else {
      this.rows = this.items.map((item, idx) => ({
        type: 'feature',
        depth: 0,
        item,
        stepCount: this.getStepCount(item),
      })) as TableRow[];
    }
  }

  private buildFolderRows(node: ImportStructureNode, depth: number): { rows: TableRow[]; stats: FolderStats } {
    const rows: TableRow[] = [];
    let totalFeatures = 0;
    let selectedFeatures = 0;
    let totalSteps = 0;

    const features = Array.isArray(node.features) ? node.features : [];
    const featureRows: TableRowFeature[] = [];

    if (!node.collapsed) {
      for (const item of features) {
        const steps = this.getStepCount(item);
        totalFeatures += 1;
        if (item.selected) {
          selectedFeatures += 1;
        }
        totalSteps += steps;
        featureRows.push({
          type: 'feature',
          depth: depth + 1,
          item,
          stepCount: steps,
        });
      }
    } else {
      for (const item of features) {
        totalFeatures += 1;
        if (item.selected) {
          selectedFeatures += 1;
        }
        totalSteps += this.getStepCount(item);
      }
    }

    const folderRows: TableRow[] = [];
    const folders = Array.isArray(node.folders) ? node.folders : [];
    for (const child of folders) {
      const childResult = this.buildFolderRows(child, depth + 1);
      totalFeatures += childResult.stats.totalFeatures;
      selectedFeatures += childResult.stats.selectedFeatures;
      totalSteps += childResult.stats.totalSteps;
      if (!node.collapsed) {
        folderRows.push(...childResult.rows);
      }
    }

    const folderRow: TableRowFolder = {
      type: 'folder',
      depth,
      node,
      collapsed: !!node.collapsed,
      featureCount: totalFeatures,
      selectedCount: selectedFeatures,
      stepCount: totalSteps,
      checked: totalFeatures > 0 && selectedFeatures === totalFeatures,
      indeterminate:
        totalFeatures > 0 && selectedFeatures > 0 && selectedFeatures < totalFeatures,
    };

    rows.push(folderRow);
    if (!node.collapsed) {
      rows.push(...featureRows, ...folderRows);
    }

    return {
      rows,
      stats: {
        totalFeatures,
        selectedFeatures,
        totalSteps,
      },
    };
  }

  getStepCount(item: ImportItem): number {
    const steps = (item.original as any)?.steps;
    return Array.isArray(steps) ? steps.length : 0;
  }

  get structureAvailable(): boolean {
    if (!this.treeRoot) {
      return false;
    }
    const hasNestedFolders = Array.isArray(this.treeRoot.folders) && this.treeRoot.folders.length > 0;
    const hasFolderPaths = Array.isArray(this.treeRoot.features)
      ? this.treeRoot.features.some(item => Array.isArray(item.folderPath) && item.folderPath.length > 0)
      : false;
    return hasNestedFolders || hasFolderPaths;
  }

  // Emits when the master checkbox toggles
  onSelectAll(checked: boolean) {
    this.selectAllChange.emit(checked);
  }

  onMaintainStructureToggle(checked: boolean) {
    this.maintainStructureChange.emit(checked);
  }

  // Bubbles row selection changes back to the dialog
  onItemSelection(item: ImportItem, checked: boolean) {
    this.selectionChange.emit({ item, selected: checked });
  }

  // Informs the parent about name edits so validation can rerun
  onNameChange(item: ImportItem, value: string) {
    this.nameChange.emit({ item, name: value });
  }

  // Shortcut for injecting the default browser set
  onAddDefault(item: ImportItem) {
    this.addDefaultBrowsers.emit(item);
  }

  onFolderSelectionClick(row: TableRow, checked: boolean) {
    if (row.type === 'folder') {
      this.folderSelectionChange.emit({ node: row.node, checked });
    }
  }

  onFolderToggle(row: TableRow) {
    if (row.type === 'folder') {
      this.folderCollapseChange.emit(row.node);
    }
  }
}
