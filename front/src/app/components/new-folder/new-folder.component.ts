import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'cometa-new-folder',
  templateUrl: './new-folder.component.html',
  styleUrls: ['./new-folder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class NewFolderComponent {}
