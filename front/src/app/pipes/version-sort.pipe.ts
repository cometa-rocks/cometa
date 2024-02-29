import { Pipe, PipeTransform } from '@angular/core';
import compareVersions from 'compare-versions';

@Pipe({
  name: 'versionSort',
  standalone: true,
})
export class VersionSortPipe implements PipeTransform {
  transform(values: BrowserstackBrowser[]): any {
    values.sort((a, b) => {
      try {
        return compareVersions(b.browser_version, a.browser_version);
      } catch (err) {
        return -1;
      }
    });
    return values;
  }
}
