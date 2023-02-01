import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'stepNew'
})
export class StepNewPipe implements PipeTransform {

  constructor() { }

  transform(dateTimestamp: number): boolean {
    if (!dateTimestamp) return false;

    const now = new Date().getTime();
    const diff = Math.abs(now - dateTimestamp);
    const daysDiff = Math.ceil(diff / (1000 * 60 * 60 * 24)); 

    console.log({dateTimestamp, now, diff, daysDiff});

    return daysDiff < 30;
  }

}
