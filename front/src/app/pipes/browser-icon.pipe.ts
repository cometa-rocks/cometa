import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Pipe({
  name: 'browserIcon',
  standalone: true,
})
export class BrowserIconPipe implements PipeTransform {
  constructor(private _sanitizer: DomSanitizer) {}

  transform(browser: BrowserstackBrowser | string): SafeStyle {
    let name;
    if (browser instanceof Object) {
      if (browser.mobile_emulation) {
        name = browser.os;
        if (name === 'ios') name = 'iphone';
      } else {
        name = browser.browser;
      }
    } else {
      name = browser;
    }
    name = name.replace(/ /, '').toLowerCase();
    return this._sanitizer.bypassSecurityTrustStyle(
      `url(assets/icons/${name}.svg)`
    );
  }
}
