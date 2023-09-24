import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Pipe({
  name: 'safeUrl',
})
export class SafeUrlPipe implements PipeTransform {
  constructor(private _sanitizer: DomSanitizer) {}

  transform(url: string): SafeUrl {
    // Returns a url correctly for HTML Binding
    return this._sanitizer.bypassSecurityTrustUrl(url);
  }
}
