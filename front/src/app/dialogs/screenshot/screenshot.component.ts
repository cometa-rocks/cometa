import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { SafeStyle, DomSanitizer } from '@angular/platform-browser';
import { FormBuilder, FormGroup } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { MatLegacyButtonModule } from '@angular/material/legacy-button';

import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import {
  MatLegacyDialog as MatDialog,
  MatLegacyDialogModule,
} from '@angular/material/legacy-dialog';
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
  imports:[MatLegacyFormFieldModule,MatLegacyInputModule, 
    MatLegacyDialogModule, ReactiveFormsModule, AsyncPipe,
    NgIf, NgFor, MatLegacyButtonModule
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
}
