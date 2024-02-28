import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'addLatest',
  standalone: true,
})
export class AddLatestPipe implements PipeTransform {
  // Those os don't have browser_version,
  // therefore 'latest' can't be added
  excluded_os = ['ios', 'android'];

  transform(_versions: BrowserstackBrowser[]): BrowserstackBrowser[] {
    // Clone array without reference
    const versions = [..._versions];
    // Only add latest version if there are at least 1 item and 'os' field isn't excluded
    if (versions.length > 0 && !this.excluded_os.includes(versions[0].os)) {
      // Push Latest version item to beginning of array
      versions.unshift({
        ...versions[0],
        browser_version: 'latest',
      });
    }
    return versions;
  }
}
