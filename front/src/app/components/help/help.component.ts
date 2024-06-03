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
    { position: 3, key: 'E', description: 'Edit Feature' },
    { position: 4, key: 'L', description: 'Show Log Output' },
    { position: 5, key: 'N', description: 'Enable/Disable notifications' },
    { position: 6, key: 'S', description: 'Edit Schedule' },
  ];

  ShortMainPage: Shortcut[] = [
    { position: 1, key: 'A', description: '[+ Add] button: Add from side nav' },
    { position: 2, key: 'B', description: '[B] button: Create folder' },
    { position: 1, key: 'F', description: '[F] button: Create feature' },
    { position: 7, key: 'Shift + Alt + F', description: 'Open search'},
    { position: 8, key: 'Shift + Alt + H', description: 'Return to home'},
    { position: 9, key: 'Shift + Alt + X', description: 'Remove all the filters'},
  ];

  ShortDataDriven: Shortcut[] = [
    { position: 1, key: 'T', description: '[Data Driven Test] button: Execution of tests based on the variables proivided by the excel sheet' },
  ];

  ShortCreateEditFeature: Shortcut[] = [
    { position: 1, key: 'D', description: 'Checkbox: Depends on other feature' },
    { position: 2, key: 'F', description: 'Checkbox: Continue on failure' },
    { position: 3, key: 'H', description: 'Checkbox: Ask for help' },
    { position: 2, key: 'M', description: 'Checkbox: Send mail on finish' },
    { position: 3, key: 'R', description: 'Checkbox: Record video' },
    { position: 5, key: 'V', description: 'Button: Edit Variables' },
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
