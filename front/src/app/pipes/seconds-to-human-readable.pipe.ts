import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'secondsToHumanReadable',
    standalone: true
})
export class SecondsToHumanReadablePipe implements PipeTransform {

  transform(value: string): string {
    if (value === null) return '';
    const val = parseInt(value, 10);
    if (val) {
      if (val < 1000) {
        // Special formatting for times smaller than 1 second
        return `${val}ms`
      }
      const d = Number(val);
      const s = Math.floor((d / 1000) % 60);
      const m = Math.floor((d / (1000 * 60)) % 60);
      const h = Math.floor((d / (1000 * 60 * 60)) % 24);
      const hDisplay = h > 0 ? h.toFixed(0) + (h === 1 ? 'h:' : 'h:') : '';
      const mDisplay = m > 0 ? m.toFixed(0) + (m === 1 ? 'm' : 'm') : '';
      const sDisplay = s > 0 ? s.toFixed(0) + (s === 1 ? 's' : 's') : '';
      return hDisplay + mDisplay + sDisplay;
    } else {
      return '0ms';
    }
  }

}
