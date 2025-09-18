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
    { position: 1, description: 'Quit the window.', key: 'ESC', windows: true, mac: false },
    { position: 2, description: 'Run Feature.', key: 'SPACE', windows: true, mac: false },
    { position: 6, description: 'Download excel file.', key: 'C', windows: true, mac: false },
    { position: 3, description: 'Edit Feature.', key: 'E', windows: true, mac: false },
    { position: 4, description: 'Show Log Output.', key: 'L', windows: true, mac: false },
    { position: 5, description: 'Enable/Disable notifications.', key: 'N', windows: true, mac: false },
    { position: 6, description: 'Download pdf file.', key: 'P', windows: true, mac: false },
    { position: 6, description: 'Edit Schedule.', key: 'S', windows: true, mac: false },

  ];

  // Main Page

  ShortMainPage: Shortcut[] = [
    { position: 1, description: '[+ Add] button: Add from side nav.', key: '+', windows: true, mac: false},
    { position: 2, description: '[B] button: Create folder.', key: 'B', windows: true, mac: false },
    { position: 3, description: '[F] button: Create feature.', key: 'F', windows: true, mac: false },
    { position: 4, description: '[P] Header Icon: Profile.', key: 'P', windows: true, mac: false },
    { position: 5, description: '[M] Header Icon: Menu.', key: 'M', windows: true, mac: false },
    { position: 6, description: 'Open search.', key: 'S', windows: true, mac: false },
    { position: 7, description: 'Close search.', key: 'ESC', windows: true, mac: false },
    { position: 8, description: 'Return to home.', key: 'H', windows: true, mac: false },
    { position: 9, description: 'Remove all the filters.', key: 'Shift + Alt + X', windows: true, mac: false },
  ];

  // Data Driven Test

  ShortDataDriven: Shortcut[] = [
    { position: 1, description: "[Columns Shown] button: Show table header's checkboxes.", key: 'S', windows: true, mac: false },
    { position: 2, description: '[Data Driven Test] button: Execution of tests based on the variables provided by the excel sheet.', key: 'T', windows: true, mac: false },
  ];

  // Create Folder

  ShortCreateFolder: Shortcut[] = [
    { position: 1, description: 'Button: OK.', key: 'CTRL+ENTER', windows: true, mac: false },
  ];

  // Create Edit Feature

  ShortCreateEditFeature: Shortcut[] = [
    { position: 1, description: 'Checkbox: Depends on other feature.', key: 'D', windows: true, mac: false },
    { position: 2, description: 'Checkbox: Continue on failure.', key: 'F', windows: true, mac: false },
    { position: 3, description: 'Checkbox: Generate dataset.', key: 'G', windows: true, mac: false },
    { position: 4, description: 'Checkbox: Ask for help.', key: 'H',  windows: true, mac: false },
    { position: 5, description: 'Checkbox: Send mail on finish.', key: 'M', windows: true, mac: false },
    { position: 6, description: 'Checkbox: Network logging.', key: 'N', windows: true, mac: false },
    { position: 7, description: 'Checkbox: Record video.', key: 'R', windows: true, mac: false },
    { position: 8, description: 'Button: Edit Variables.', key: 'V', windows: true, mac: false },
    { position: 9, description: 'Button: Open Mobiles.', key: 'S', windows: true, mac: false },
    { position: 10, description: 'Button: CREATE/SAVE.', key: 'CTRL+ENTER', windows: true, mac: false },
    { position: 11, description: 'Textarea: Insert new step above or below.', key: 'CTRL+UP/DOWN', windows: true, mac: false },
    { position: 12, description: 'Textarea: Copy the step above or below of the reference step.', key: 'CTRL+ALT+UP/DOWN', windows: true, mac: false },
  ];

  // Step Editor

  ShortStepEditor: Shortcut[] = [
    { position: 1, description: 'Checkbox (Select): Hold Shift and click another checkbox to select all checkboxes between the first and the second click.', key: 'SHIFT', windows: true, mac: false },
    { position: 3, description: 'Textarea: Insert tab character in textarea.', key: 'TAB', windows: true, mac: false },
    { position: 4, description: 'Textarea: Insert new step above the current step.', key: 'CTRL+UP', windows: true, mac: false },
    { position: 5, description: 'Textarea: Insert new step above the current step.', key: 'ALT+UP', windows: false, mac: true },
    { position: 6, description: 'Textarea: Insert new step below the current step.', key: 'CTRL+DOWN', windows: true, mac: false },
    { position: 7, description: 'Textarea: Insert new step below the current step.', key: 'ALT+DOWN', windows: false, mac: true },
    { position: 8, description: 'Textarea: Copy the step above the current step.', key: 'CTRL+ALT+UP', windows: true, mac: false },
    { position: 9, description: 'Textarea: Copy the step below the current step.', key: 'CTRL+ALT+DOWN', windows: true, mac: false },
    { position: 10, description: 'Textarea: Open file autocomplete dialog when cursor is inside {"file_path"} quotes.', key: 'ALT+SHIFT+F', windows: true, mac: false },
    { position: 11, description: 'Textarea: Open file autocomplete dialog when cursor is inside {"file_path"} quotes.', key: 'META+SHIFT+F', windows: false, mac: true }
    
  ];

  // Administration
  ShortAdministration: Shortcut[] = [
    { position: 10, description: 'Button: OK/CREATE/MODIFY.', key: 'CTRL+ENTER', windows: true, mac: false },
  ];

  // Reference model (template)
  columns: MtxGridColumn[] = [
    { header: 'Description', field: 'description'},
    { header: 'Shortcut', field: 'key'},
    { 
      header: 'Windows', 
      field: 'windows',
      type: 'string' as MtxGridColumnType,
      formatter: (row: any) => row.windows ? '✓' : ' ',
    },
    { 
      header: 'Mac', 
      field: 'mac',
      type: 'string' as MtxGridColumnType, 
      formatter: (row: any) => row.mac ? '✓' : ' ',
    },
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
