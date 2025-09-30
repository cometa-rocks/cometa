import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { MatLegacyCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';

import { ImportItem } from '../import-features.component';

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
    FormsModule,
    NgIf,
    NgFor,
  ],
})
export class ImportFeaturesTableComponent {
  @Input() items: ImportItem[] = [];
  @Input() allSelected = false;
  @Input() browsersLabel!: (item: ImportItem) => string;
  @Input() requiresBrowsers!: (original: any) => boolean;

  @Output() selectAllChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<{ item: ImportItem; selected: boolean }>();
  @Output() nameChange = new EventEmitter<{ item: ImportItem; name: string }>();
  @Output() addDefaultBrowsers = new EventEmitter<ImportItem>();

  trackByIndex = (index: number) => index;

  onSelectAll(checked: boolean) {
    this.selectAllChange.emit(checked);
  }

  onItemSelection(item: ImportItem, checked: boolean) {
    this.selectionChange.emit({ item, selected: checked });
  }

  onNameChange(item: ImportItem, value: string) {
    this.nameChange.emit({ item, name: value });
  }

  onAddDefault(item: ImportItem) {
    this.addDefaultBrowsers.emit(item);
  }
}

