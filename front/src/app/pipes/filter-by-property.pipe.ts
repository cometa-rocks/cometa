import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterByProperty',
  standalone: true
})
export class FilterByPropertyPipe implements PipeTransform {
  transform(array: any[], filter: { [key: string]: any }): any[] {
    if (!array || !filter) {
      return array;
    }

    return array.filter(item => {
      // Si el item no tiene la propiedad marked_for_deletion, lo mostramos
      if (!('marked_for_deletion' in item)) {
        return true;
      }
      
      // Si tiene la propiedad, solo mostramos si es false
      return item.marked_for_deletion === false;
    });
  }
}
