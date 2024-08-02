import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { ConfigState } from '@store/config.state';
import { ActionsState } from '@store/actions.state';
import { Observable } from 'rxjs';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { NgFor, AsyncPipe } from '@angular/common';

// Mtx table hotkeys
import { MtxGridColumn } from '@ng-matero/extensions/grid';
import { MtxGridModule } from '@ng-matero/extensions/grid';


interface Shortcut {
  position: number;
  key: string;
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

  ShortMainViewFeature: Shortcut[] = [
    { position: 1, key: 'ESC', description: 'Quit the window' },
    { position: 2, key: 'SPACE', description: 'Run Feature' },
    { position: 6, key: 'C', description: 'Download excel file' },
    { position: 3, key: 'E', description: 'Edit Feature' },
    { position: 4, key: 'L', description: 'Show Log Output' },
    { position: 5, key: 'N', description: 'Enable/Disable notifications' },
    { position: 6, key: 'P', description: 'Download pdf file' },
    { position: 6, key: 'S', description: 'Edit Schedule' },
    
  ];

  ShortMainPage: Shortcut[] = [
    { position: 1, key: '+', description: '[+ Add] button: Add from side nav' },
    { position: 2, key: 'B', description: '[B] button: Create folder' },
    { position: 3, key: 'F', description: '[F] button: Create feature' },
    { position: 4, key: 'P', description: '[P] Header Icon: Profile' },
    { position: 5, key: 'M', description: '[M] Header Icon: Menu' },
    { position: 6, key: 'Shift + Alt + F', description: 'Open search'},
    { position: 7, key: 'Shift + Alt + H', description: 'Return to home'},
    { position: 8, key: 'Shift + Alt + X', description: 'Remove all the filters'},
  ];

  ShortDataDriven: Shortcut[] = [
    { position: 1, key: 'S', description: "[Columns Shown] button: Show table header's checkboxes" },
    { position: 2, key: 'T', description: '[Data Driven Test] button: Execution of tests based on the variables provided by the excel sheet' },
  ];

  ShortCreateEditFeature: Shortcut[] = [
    { position: 1, key: 'D', description: 'Checkbox: Depends on other feature' },
    { position: 2, key: 'F', description: 'Checkbox: Continue on failure' },
    { position: 3, key: 'G', description: 'Checkbox: Generate dataset' },
    { position: 4, key: 'H', description: 'Checkbox: Ask for help' },
    { position: 5, key: 'M', description: 'Checkbox: Send mail on finish' },
    { position: 6, key: 'N', description: 'Checkbox: Network logging' },
    { position: 7, key: 'R', description: 'Checkbox: Record video' },
    { position: 8, key: 'V', description: 'Button: Edit Variables' },
    { position: 9, key: 'CTRL+UP/DOWN', description: 'Textarea: Insert new step above or below' },
    { position: 10, key: 'CTRL+ALT+UP/DOWN', description: 'Textarea: Copy the step above or below of the reference step' },
  ];

  columns: MtxGridColumn[] = [
    { header: 'Shortcut', field: 'key' },
    { header: 'Description', field: 'description' },
  ];

  listMainViewFeature = this.ShortMainViewFeature;
  listMainPage = this.ShortMainPage;
  listDataDriven = this.ShortDataDriven;
  listCreateEditFeature = this.ShortCreateEditFeature;

  trackByName(index: number, item: any) {
    return item.name;
  }

}
