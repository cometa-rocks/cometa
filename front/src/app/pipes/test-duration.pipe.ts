import { Pipe, PipeTransform } from '@angular/core';
import { Observable, timer, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { differenceInMilliseconds, isValid } from 'date-fns';

@Pipe({
    name: 'testDuration',
    standalone: true
})
export class TestDurationPipe implements PipeTransform {

  transform(startTime: Date | null, endTime: Date | null): Observable<string> {
    if (startTime && isValid(startTime)) {
      if (endTime && isValid(endTime)) {
        return of(this.getDifferenceTime(startTime, endTime));
      } else {
        return timer(0, 1000).pipe(
          map(_ => this.getDifferenceTime(startTime, new Date()))
        )
      }
    } else {
      return of('');
    }
  }

  getDifferenceTime(start: Date, end: Date) {
    const seconds = Math.abs(differenceInMilliseconds(start, end));
    const s = Math.floor((seconds / 1000) % 60);
    const m = Math.floor((seconds / (1000 * 60)) % 60);
    const h = Math.floor((seconds / (1000 * 60 * 60)) % 24);
    const hDisplay = h > 0 ? (h > 9 ? h.toFixed(0) : `0${h}`) + ':' : '';
    const mDisplay = m > 9 ? m.toFixed(0) : `0${m}`;
    const sDisplay = s > 9 ? s.toFixed(0) : `0${s}`;
    return hDisplay + mDisplay + ':' + sDisplay;
  }

}
