import { Pipe, PipeTransform } from '@angular/core';
import { getBrowserComboText } from '@services/tools';

@Pipe({
    name: 'browserComboText',
    standalone: true
})
export class BrowserComboTextPipe implements PipeTransform {

  transform(browser: BrowserstackBrowser | string, so: boolean = true): string {
    if (typeof browser === 'string') {
      browser = JSON.parse(browser) as BrowserstackBrowser;
    }
    return getBrowserComboText(browser, so);
  }

}
