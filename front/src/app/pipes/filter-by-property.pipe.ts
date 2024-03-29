import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterByProperty',
  standalone: true,
})
export class FilterByPropertyPipe implements PipeTransform {
  transform(array: any[], prop: string, value: any) {
    return array.filter(el => el[prop] === value);
  }
}
