import { Pipe, PipeTransform } from '@angular/core';
import { getBrowserComboText } from '@services/tools';

@Pipe({
  name: 'standByBrowserComboText',
  standalone: true,
})
export class StandByBrowserComboTextPipe implements PipeTransform {
  transform(browser: Container ): string {
    return `${browser.image_name}:${browser.image_version}             ${browser.id}`;
  }
}
