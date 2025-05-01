import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss'],
  standalone: true,
  imports: [MatProgressSpinnerModule, CommonModule]
})
export class LoadingSpinnerComponent {
  @Input() isVisible = true;
  @Input() size = 40;
  @Input() message?: string;
  @Input() paddingTop = 40;
  @Input() paddingBottom = 40;
} 