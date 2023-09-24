import { Pipe, PipeTransform } from '@angular/core';
import { sortBy } from 'ngx-amvara-toolbox';

@Pipe({
  name: 'sortBy',
})
export class SortByPipe implements PipeTransform {
  transform(
    items: any[],
    index: number | string,
    reverse: boolean = false
  ): any[] {
    const sorted = sortBy(items, index);
    return reverse ? sorted.reverse() : sorted;
  }
}
