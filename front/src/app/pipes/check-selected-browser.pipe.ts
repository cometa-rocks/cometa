import { Pipe, PipeTransform, Host } from '@angular/core';
import { BrowserSelectionComponent } from '@components/browser-selection/browser-selection.component';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Pipe({
  name: 'checkSelectedBrowser',
})
export class CheckSelectedBrowserPipe implements PipeTransform {
  constructor(@Host() private _browserSelection: BrowserSelectionComponent) {}

  // Check wether or not a browser is selected
  transform(browser: BrowserstackBrowser): Observable<boolean> {
    return this._browserSelection.browsersSelected.pipe(
      map(selectedBrowsers =>
        selectedBrowsers.some(
          br =>
            br.browser == browser.browser &&
            br.os == browser.os &&
            br.os_version == browser.os_version &&
            br.browser_version == browser.browser_version &&
            br.device == browser.device &&
            br.real_mobile == browser.real_mobile
        )
      )
    );
  }
}
