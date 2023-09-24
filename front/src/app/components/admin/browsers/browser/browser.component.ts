import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'browser',
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowserComponent {
  @Input() browser: BrowserstackBrowser;
}
