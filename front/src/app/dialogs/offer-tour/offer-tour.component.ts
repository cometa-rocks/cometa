import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { Tour } from '@services/tours';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'offer-tour',
  templateUrl: './offer-tour.component.html',
  styleUrls: ['./offer-tour.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class OfferTourComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Tour) {}
}
