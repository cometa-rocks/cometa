import { Pipe, PipeTransform } from '@angular/core';
import { CustomSelectors } from '@others/custom-selectors';

@Pipe({
  name: 'filterText',
  standalone: true,
})
export class FilterTextPipe implements PipeTransform {
  transform = (filter: Filter) => CustomSelectors.FilterTextFunction(filter);
}
