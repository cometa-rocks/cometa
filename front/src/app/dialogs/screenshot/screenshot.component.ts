import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';
import { FormBuilder, FormGroup } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import {
  ReactiveFormsModule,
} from '@angular/forms';
import { NgIf, NgFor, AsyncPipe, NgTemplateOutlet } from '@angular/common';


@Component({
  selector: 'cometa-screenshot',
  templateUrl: './screenshot.component.html',
  styleUrls: ['./screenshot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports:[MatFormFieldModule,MatInputModule, 
    MatDialogModule, ReactiveFormsModule, AsyncPipe,
    NgIf, NgFor, MatButtonModule
  ]
})

export class ScreenshotComponent {
  image: SafeStyle;
  chatWindow: string = "";
  isChatOpen: boolean=false;
  message:string=""
  messages:string[] = []
  response:string = "Please ask Cometa AI to about the screenshot";
  chatForm: FormGroup;
  saving$ = new BehaviorSubject<boolean>(false); 
  constructor(
    @Inject(MAT_DIALOG_DATA) private screenshot: string,
    public dialogRef: MatDialogRef<ScreenshotComponent>,
    private _sanitizer: DomSanitizer,
    private fb: FormBuilder
  ) {
    this.image = this._sanitizer.bypassSecurityTrustStyle(
      `url(/v2/screenshots/${this.screenshot})`
    );
    this.chatForm = this.fb.group({
      chatText: ['']
    });
  }

  openChatWindow() {
    this.isChatOpen = !this.isChatOpen;
  }
  
  chat(){
    console.log("Sending message",this.message);
  }

  // onSubmit() {
  //   console.log('Chat text:', this.chatForm.get('chatText').value);
  //   this.chat();
  // }

  isInputFocused(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      (active as HTMLElement).isContentEditable
    );
  }

}
