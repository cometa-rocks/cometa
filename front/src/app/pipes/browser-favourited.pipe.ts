import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'browserFavourited',
    standalone: true
})
export class BrowserFavouritedPipe implements PipeTransform {

  transform(browser: BrowserstackBrowser, favourites: BrowserstackBrowser[]): boolean {
    return favourites.some(fav => {
      return fav.browser === browser.browser &&
             fav.os === browser.os &&
             fav.os_version === browser.os_version &&
             fav.browser_version === browser.browser_version &&
             fav.device === browser.device &&
             fav.real_mobile === browser.real_mobile;
    });
  }

}
