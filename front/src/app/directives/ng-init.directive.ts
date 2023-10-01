import {Directive, Input, Output, EventEmitter} from '@angular/core';

@Directive({
    selector: '[ngInit]',
    standalone: true
})
export class NgInitDirective {

  @Input() isLast: boolean;

  @Output('ngInit') initEvent: EventEmitter<any> = new EventEmitter();

  ngOnInit() {
    // This is a debugging if to get timings for page loading ... disable this on PROD 
    if (this.isLast) {
      setTimeout(() => this.initEvent.emit(), 10);
    }
  }
}