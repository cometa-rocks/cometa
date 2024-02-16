import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TourService } from '@services/tour.service';

@Component({
  selector: 'cometa-tours',
  templateUrl: './tours.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToursComponent {
  constructor(public _tourService: TourService) {}
}
