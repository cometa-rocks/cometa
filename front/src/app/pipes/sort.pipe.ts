import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sort',
  standalone: true
})
export class SortPipe implements PipeTransform {
  transform(array: any[], field: string): any[] {
    if (!Array.isArray(array)) {
      return array;
    }
    
    return array.sort((a: any, b: any) => {
      const aValue = a[field];
      const bValue = b[field];
      
      // Ensure we're comparing numbers
      const numA = parseInt(aValue, 10);
      const numB = parseInt(bValue, 10);
      
      // If both are valid numbers, compare numerically
      if (!isNaN(numA) && !isNaN(numB)) {
        const result = numA - numB;
        return result;
      }
      
      // Fallback to string comparison if not numbers
      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return result;
    });
  }
} 