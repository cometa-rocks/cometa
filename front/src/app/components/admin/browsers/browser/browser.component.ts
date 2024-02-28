import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { BrowserComboTextPipe } from '../../../../pipes/browser-combo-text.pipe';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';

@Component({
  selector: 'browser',
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DisableAutocompleteDirective, BrowserComboTextPipe],
})
export class BrowserComponent {
  @Input() browser: BrowserstackBrowser;
}
