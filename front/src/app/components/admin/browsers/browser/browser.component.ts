import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { BrowserComboTextPipe } from '../../../../pipes/browser-combo-text.pipe';
import { DisableAutocompleteDirective } from '../../../../directives/disable-autocomplete.directive';
import { InputFocusService } from '@services/inputFocus.service';

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
  inputFocus: boolean = false;

  constructor(private inputFocusService: InputFocusService) {}

  // Check if focused on input or textarea
  onInputFocus() {
    this.inputFocusService.setInputFocus(true);
  }

  onInputBlur() {
    this.inputFocusService.setInputFocus(false);
  }
}
