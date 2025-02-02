import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Pipe({
  name: 'mobileIcon',
  standalone: true,
})
export class MobileIconPipe implements PipeTransform {
  constructor(private _sanitizer: DomSanitizer) {}
  // FIXME 
  // This method needs to be fixed
  transform(mobile: IMobile | string): SafeStyle {
    // let name;
    // if (mobile instanceof Object) {
    //   if (mobile.mobile_json.image) {
    //     name = mobile.os;
    //     if (name === 'ios') name = 'iphone';
    //   } else {
    //     name = mobile.icon;
    //   }
    // } else {
    //   name = mobile;
    // }
    // name = name.replace(/ /, '').toLowerCase();
    return this._sanitizer.bypassSecurityTrustStyle(
      `url(assets/icons/mobile.svg)`
    );
  }
}
