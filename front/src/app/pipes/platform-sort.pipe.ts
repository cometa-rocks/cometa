import { Pipe, PipeTransform } from '@angular/core';
import { ReleaseDates } from '@others/release-dates';
import { parse } from 'date-fns';
import compareVersions from 'compare-versions';

@Pipe({
  name: 'platformSort',
})
export class PlatformSortPipe implements PipeTransform {
  transform(values: any[], os: string): any {
    values = values.concat();
    values.sort((a, b) => {
      try {
        if (ReleaseDates.hasOwnProperty(os)) {
          return (
            parse(ReleaseDates[os][b], 'yyyy-MM-dd', new Date()).valueOf() -
            parse(ReleaseDates[os][a], 'yyyy-MM-dd', new Date()).valueOf()
          );
        }
        return compareVersions(b, a);
      } catch (err) {
        return -1;
      }
    });
    return values;
  }
}
