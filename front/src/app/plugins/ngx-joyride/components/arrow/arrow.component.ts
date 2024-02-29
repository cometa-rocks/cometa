import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'joyride-arrow',
  templateUrl: './arrow.component.html',
  styleUrls: ['./arrow.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
})
export class JoyrideArrowComponent {
  @Input()
  position: string = 'top';
}
