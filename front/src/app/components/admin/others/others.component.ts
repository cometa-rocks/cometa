import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'admin-others',
  templateUrl: './others.component.html',
  styleUrls: ['./others.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminOthersComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
