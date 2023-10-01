import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Select } from '@ngxs/store';
import { ConfigState } from '@store/config.state';
import { ActionsState } from '@store/actions.state';
import { Observable } from 'rxjs';
import { SortByPipe } from '@pipes/sort-by.pipe';
import { NgFor, AsyncPipe } from '@angular/common';

@Component({
    selector: 'cometa-help',
    templateUrl: './help.component.html',
    styleUrls: ['./help.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgFor, SortByPipe, AsyncPipe]
})
export class HelpComponent {

  @Select(ActionsState) actions$: Observable<Action[]>;
  @Select(ConfigState) config$: Observable<Config>;

  hotkeys = [
    { hotkey: 'ESC', text: 'Quit' },
    { hotkey: 'Space', text: 'Run Feature' },
    { hotkey: 'E', text: 'Edit Feature' },
    { hotkey: 'L', text: 'Show Log Output' },
    { hotkey: 'N', text: 'Enable/Disable notifications' },
    { hotkey: 'S', text: 'Edit Schedule' },
    { hotkey: 'Shift + Alt + F', text: 'Open search'},
    { hotkey: 'Shift + Alt + H', text: 'Return to home'},
    { hotkey: 'Shift + Alt + X', text: 'Remove all the filters'}
  ]

}
