import { Pipe, PipeTransform } from '@angular/core';
import { CustomSelectors } from '@others/custom-selectors';

@Pipe({
  name: 'filterText',
})
export class FilterTextPipe implements PipeTransform {
  transform = (filter: Filter) => CustomSelectors.FilterTextFunction(filter);
}
