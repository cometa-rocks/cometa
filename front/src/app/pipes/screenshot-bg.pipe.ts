import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Pipe({
    name: 'screenshotBg',
    standalone: true
})
export class ScreenshotBgPipe implements PipeTransform {

  constructor(
    private _sanitizer: DomSanitizer
  ) { }

  transform(image: string): SafeStyle {
    return this._sanitizer.bypassSecurityTrustStyle(`url(/v2/screenshots/${image})`);
  }

}
