import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TourService } from '@services/tour.service';
import { AttachToDirective } from '../../directives/attach-to.directive';
import { JoyrideDirective } from '../../plugins/ngx-joyride/directives/joyride.directive';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';

@Component({
  selector: 'cometa-tours',
  templateUrl: './tours.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgIf, NgFor, JoyrideDirective, AttachToDirective, AsyncPipe],
})
export class ToursComponent {
  constructor(public _tourService: TourService) {}
}
