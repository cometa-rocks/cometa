import { Subscribe } from 'ngx-amvara-toolbox';
import { Component, ChangeDetectionStrategy, ViewChild, TemplateRef } from '@angular/core';
import { Select, Actions } from '@ngxs/store';
import { ConfigState } from '@store/config.state';
import { ActionsState } from '@store/actions.state';
import { Observable } from 'rxjs';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { NgFor, AsyncPipe } from '@angular/common';

// Mtx table hotkeys
import { MtxGridColumn, MtxGridColumnType, MtxGridModule } from '@ng-matero/extensions/grid';

interface Shortcut {
  position: number;
  key: string;
  windows?: boolean;
  mac?: boolean;
  description: string;
}

@Component({
  selector: 'cometa-help',
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgFor, SortByPipe, AsyncPipe, MtxGridModule],
})
export class HelpComponent {
  @Select(ActionsState) actions$: Observable<Action[]>;
  @Select(ConfigState) config$: Observable<Config>;

  // Main View Feature
  ShortMainViewFeature: Shortcut[] = [
    { position: 1, key: 'ESC', windows: true, mac: false, description: 'Quit the window.' },
    { position: 2, key: 'SPACE', windows: true, mac: false, description: 'Run Feature.' },
    { position: 6, key: 'C', windows: true, mac: false, description: 'Download excel file.' },
    { position: 3, key: 'E', windows: true, mac: false, description: 'Edit Feature.' },
    { position: 4, key: 'L', windows: true, mac: false, description: 'Show Log Output.' },
    { position: 5, key: 'N', windows: true, mac: false, description: 'Enable/Disable notifications.' },
    { position: 6, key: 'P', windows: true, mac: false, description: 'Download pdf file.' },
    { position: 6, key: 'S', windows: true, mac: false, description: 'Edit Schedule.' },

  ];

  // Main Page

  ShortMainPage: Shortcut[] = [
    { position: 1, key: '+', windows: true, mac: false, description: '[+ Add] button: Add from side nav.' },
    { position: 2, key: 'B', windows: true, mac: false, description: '[B] button: Create folder.' },
    { position: 3, key: 'F', windows: true, mac: false, description: '[F] button: Create feature.' },
    { position: 4, key: 'P', windows: true, mac: false, description: '[P] Header Icon: Profile.' },
    { position: 5, key: 'M', windows: true, mac: false, description: '[M] Header Icon: Menu.' },
    { position: 6, key: 'S', windows: true, mac: false, description: 'Open search.'},
    { position: 7, key: 'ESC', windows: true, mac: false, description: 'Close search.'},
    { position: 8, key: 'H', windows: true, mac: false, description: 'Return to home.'},
    { position: 9, key: 'Shift + Alt + X', windows: true, mac: false, description: 'Remove all the filters.'},
  ];

  // Data Driven Test

  ShortDataDriven: Shortcut[] = [
    { position: 1, key: 'S', windows: true, mac: false, description: "[Columns Shown] button: Show table header's checkboxes." },
    { position: 2, key: 'T', windows: true, mac: false, description: '[Data Driven Test] button: Execution of tests based on the variables provided by the excel sheet.' },
  ];

  // Create Folder

  ShortCreateFolder: Shortcut[] = [
    { position: 1, key: 'CTRL+ENTER', windows: true, mac: false, description: 'Button: OK.' },
  ];

  // Create Edit Feature

  ShortCreateEditFeature: Shortcut[] = [
    { position: 1, key: 'D', windows: true, mac: false, description: 'Checkbox: Depends on other feature.' },
    { position: 2, key: 'F', windows: true, mac: false, description: 'Checkbox: Continue on failure.' },
    { position: 3, key: 'G', windows: true, mac: false, description: 'Checkbox: Generate dataset.' },
    { position: 4, key: 'H',  windows: true, mac: false, description: 'Checkbox: Ask for help.' },
    { position: 5, key: 'M', windows: true, mac: false, description: 'Checkbox: Send mail on finish.' },
    { position: 6, key: 'N', windows: true, mac: false, description: 'Checkbox: Network logging.' },
    { position: 7, key: 'R', windows: true, mac: false, description: 'Checkbox: Record video.' },
    { position: 8, key: 'V', windows: true, mac: false, description: 'Button: Edit Variables.' },
    { position: 9, key: 'S', windows: true, mac: false, description: 'Button: Open Mobiles.' },
    { position: 10, key: 'CTRL+ENTER', windows: true, mac: false, description: 'Button: CREATE/SAVE.' },
    { position: 11, key: 'CTRL+UP/DOWN', windows: true, mac: false, description: 'Textarea: Insert new step above or below.' },
    { position: 12, key: 'CTRL+ALT+UP/DOWN', windows: true, mac: false, description: 'Textarea: Copy the step above or below of the reference step.' },
  ];

  // Step Editor

  ShortStepEditor: Shortcut[] = [
    { position: 1, key: 'SHIFT', windows: true, mac: false, description: 'Checkbox (Select): Hold Shift and click another checkbox to select all checkboxes between the first and the second click.' },
    { position: 3, key: 'TAB', windows: true, mac: false, description: 'Textarea: Insert tab character in textarea.' },
    { position: 4, key: 'CTRL+UP', windows: true, mac: false, description: 'Textarea: Insert new step above the current step.' },
    { position: 5, key: 'ALT+UP', windows: true, mac: false, description: 'Textarea: Insert new step above the current step.' },
    { position: 6, key: 'CTRL+DOWN', windows: true, mac: false, description: 'Textarea: Insert new step below the current step.' },
    { position: 7, key: 'ALT+DOWN', windows: true, mac: false, description: 'Textarea: Insert new step below the current step.' },
    { position: 8, key: 'CTRL+ALT+UP', windows: true, mac: false, description: 'Textarea: Copy the step above the current step.' },
    { position: 9, key: 'CTRL+ALT+DOWN', windows: true, mac: false, description: 'Textarea: Copy the step below the current step.' },
    { position: 10, key: 'ALT+SHIFT+F', windows: true, mac: false, description: 'Textarea: Open file autocomplete dialog when cursor is inside {"file_path"} quotes.' },
    { position: 11, key: 'META+SHIFT+F', windows: false, mac: true, description: 'Textarea: Open file autocomplete dialog when cursor is inside {"file_path"} quotes.' }
    
  ];

  // Administration
  ShortAdministration: Shortcut[] = [
    { position: 10, key: 'CTRL+ENTER', windows: true, mac: false, description: 'Button: OK/CREATE/MODIFY.' },
  ];

  // Reference model (template)
  columns: MtxGridColumn[] = [
    { 
      header: 'Windows', 
      field: 'windows',
      type: 'string' as MtxGridColumnType,
      formatter: (row: any) => row.windows ? '✓' : ' ',
      class: 'text-center',
    },
    { 
      header: 'Mac', 
      field: 'mac',
      type: 'string' as MtxGridColumnType, 
      formatter: (row: any) => row.mac ? '✓' : ' ',
      class: 'text-center',
    },
    { header: 'Shortcut', field: 'key', class: 'shortcut-key'},
    { header: 'Description', field: 'description'},
  ];

  listMainViewFeature = this.ShortMainViewFeature;
  listMainPage = this.ShortMainPage;
  listDataDriven = this.ShortDataDriven;
  listCreateEditFeature = this.ShortCreateEditFeature;
  listAdministration = this.ShortAdministration;
  listCreateFolder = this.ShortCreateFolder;
  listStepEditor = this.ShortStepEditor;

  trackByName(index: number, item: any) {
    return item.name;
  }
}
