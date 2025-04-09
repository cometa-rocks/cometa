import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { ChatbotService, ChatMessage } from '../../services/chatbot.service';
import { Observable, Subscription } from 'rxjs';
import { LogService } from '@services/log.service';

@Component({
  selector: 'cometa-chat-popup',
  template: `
    <div class="chat-popup-container" (keydown)="handleKeyDown($event)">
      <div class="chat-popup">
        <div class="chat-popup-header">
          <div class="chat-title">
            <span class="secondary-color as-text">Co.</span>Meta Support
          </div>
          <div class="window-controls">
            <button mat-icon-button (click)="closePopup()" class="close-button">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
        
        <div class="chat-messages" #messagesContainer>
          <div *ngFor="let message of messages$ | async" class="message" [ngClass]="{'user-message': message.isUser, 'bot-message': !message.isUser}">
            <div class="message-content">
              <div class="message-text">
                <span>{{ message.text }}</span>
              </div>
              <div class="message-time">{{ message.timestamp | date:'shortTime' }}</div>
            </div>
          </div>
          
          <!-- Loading indicator -->
          <div *ngIf="isLoading$ | async" class="message bot-message">
            <div class="message-content">
              <div class="message-text typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="chat-input">
          <input 
            type="text" 
            [(ngModel)]="newMessage" 
            placeholder="Type your message..." 
            (keyup.enter)="sendMessage()"
            [disabled]="!(isAiFeatureEnabled$ | async) || (isLoading$ | async)"
            autofocus
          >
          <button mat-icon-button color="primary" (click)="sendMessage()" [disabled]="!(isAiFeatureEnabled$ | async) || !newMessage.trim() || (isLoading$ | async)">
            <mat-icon *ngIf="!(isLoading$ | async)">send</mat-icon>
            <mat-icon *ngIf="isLoading$ | async" class="rotating">sync</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./chat-popup.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule
  ]
})
export class ChatPopupComponent implements OnInit, OnDestroy {
  messages$: Observable<ChatMessage[]>;
  isLoading$: Observable<boolean>;
  isAiFeatureEnabled$: Observable<boolean>;
  newMessage = '';
  private subscriptions: Subscription[] = [];
  private beforeUnloadHandler: any;
  private isCurrentlyLoading = false;
  private isAiFeatureEnabled = false;
  
  @ViewChild('messagesContainer') messagesContainer: ElementRef;
  
  constructor(
    private chatbotService: ChatbotService,
    @Inject(DOCUMENT) private document: Document,
    private cdr: ChangeDetectorRef,
    private log: LogService
  ) { }
  
  ngOnInit(): void {
    this.log.msg('1', 'Initializing component', 'chat-popup');
    
    // Set the page title
    this.document.title = 'Co.Meta Support Chat';
    
    // Hide any other UI elements that might be present
    this.hideMainUI();
    
    // Get messages and loading state from service
    this.messages$ = this.chatbotService.messages$;
    this.isLoading$ = this.chatbotService.isLoading$;
    this.isAiFeatureEnabled$ = this.chatbotService.isAiFeatureEnabled$;
    
    // Subscribe to AI feature status
    this.subscriptions.push(
      this.isAiFeatureEnabled$.subscribe(enabled => {
        this.isAiFeatureEnabled = enabled;
        this.log.msg('1', `AI feature is ${enabled ? 'enabled' : 'disabled'}`, 'chat-popup');
      })
    );
    
    // Subscribe to loading state
    this.subscriptions.push(
      this.isLoading$.subscribe(isLoading => {
        this.isCurrentlyLoading = isLoading;
      })
    );
    
    // Open chat in service
    this.chatbotService.openChat();
    
    // Subscribe to messages to scroll to bottom on new messages
    this.subscriptions.push(
      this.messages$.subscribe(() => {
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      })
    );
    
    // Listen for beforeunload to notify parent window
    this.beforeUnloadHandler = this.handleBeforeUnload.bind(this);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }
  
  ngOnDestroy(): void {
    this.log.msg('1', 'Component destroying', 'chat-popup');
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Remove event listener
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }
  
  // Hide any main UI elements that might be present
  private hideMainUI(): void {
    // Try to find and hide main app elements
    const appRoot = this.document.querySelector('app-root');
    if (appRoot) {
      const children = appRoot.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        if (child.tagName !== 'COMETA-CHAT-POPUP') {
          child.style.display = 'none';
        }
      }
    }
    
    // Add a style to ensure the chat popup takes the full screen
    const style = this.document.createElement('style');
    style.textContent = `
      body, html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        height: 100%;
        width: 100%;
      }
      app-root {
        display: block;
        height: 100%;
        width: 100%;
      }
      cometa-chat-popup {
        display: block;
        height: 100%;
        width: 100%;
      }
    `;
    this.document.head.appendChild(style);
  }
  
  // Handle beforeunload event
  private handleBeforeUnload(): void {
    // If there's a parent window, could send a message to it
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: 'chat-popup-closed' }, this.document.location.origin);
      } catch (error) {
        this.log.msg('2', 'Error sending message to parent', 'chat-popup', error);
      }
    }
  }
  
  // Scroll messages container to bottom
  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
  
  // Send a new message
  sendMessage(): void {
    if (this.newMessage.trim() === '' || this.isCurrentlyLoading || !this.isAiFeatureEnabled) return;
    
    // Send the message to service
    this.chatbotService.handleUserMessage(this.newMessage);
    
    // Clear the input
    this.newMessage = '';
  }
  
  // Prevent keyboard shortcuts from the main application
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Only handle Escape key to close the popup
    if (event.key === 'Escape') {
      this.closePopup();
      return;
    }
    
    // Stop propagation for all other keyboard events to prevent app shortcuts
    event.stopPropagation();
  }
  
  // Close the popup window
  closePopup(): void {
    window.close();
  }
} 