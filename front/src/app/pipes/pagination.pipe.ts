import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'pagination',
    standalone: true
})
export class PaginationPipe implements PipeTransform {

  transform(values: any[], page: number, size: number): any[] {
    return [ ...values?.slice( size * (page) , size * (page + 1) ) ];
  }

}
