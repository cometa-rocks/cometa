import {
  Component,
  Inject,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'html-diff',
  templateUrl: './html-diff.component.html',
  styleUrls: ['./html-diff.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class HtmlDiffDialog {
  constructor(
    private dialogRef: MatDialogRef<HtmlDiffDialog>,
    @Inject(MAT_DIALOG_DATA) public diff: string
  ) {
    // Replace <ins>x</ins> and <del>x</del> with red and green markups
    this.diff = this.diff
      .replace(/\</g, '&lt;')
      .replace(/\>/g, '&gt;')
      .replace(
        /(?=\&lt;ins\&gt;)(.+)(?=\&lt;\/ins\&gt;)/gs,
        '<span class="insert">$1</span>'
      )
      .replace(
        /(?=\&lt;del\&gt;)(.+)(?=\&lt;\/del\&gt;)/gs,
        '<span class="delete">$1</span>'
      )
      .replace(
        /\&lt;ins\&gt;|\&lt;\/ins\&gt;|\&lt;del\&gt;|\&lt;\/del\&gt;/gs,
        ''
      );
  }

  @HostListener('document:keydown', ['$event']) handleKeyboardEvent(
    event: KeyboardEvent
  ) {
    // Escape key
    if (event.keyCode === 27) this.dialogRef.close();
  }
}
