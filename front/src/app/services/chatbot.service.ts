import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { Configuration } from '../store/actions/config.actions';
import { API_BASE } from '../tokens';
import { catchError, timeout } from 'rxjs/operators';

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatCompletionResponse {
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private isOpenSubject = new BehaviorSubject<boolean>(false);
  public isOpen$ = this.isOpenSubject.asObservable();
  
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();
  
  // Flag to track if initial greeting has been shown
  private initialGreetingShown = false;
  
  // AI service availability tracking
  private aiServiceAvailable = true;

  constructor(
    private http: HttpClient,
    private store: Store,
    @Inject(API_BASE) public base: string
  ) {
    // Initialize with welcome message
    this.addInitialGreeting();
    
    // Subscribe to store changes for chatbot state
    this.store.select(state => state.config.internal.chatbotOpen)
      .subscribe(isOpen => {
        if (isOpen !== undefined) {
          this.isOpenSubject.next(isOpen);
        }
      });
  }

  // Add initial greeting message
  private addInitialGreeting(): void {
    if (!this.initialGreetingShown) {
      const messages = this.messagesSubject.getValue();
      messages.push({
        text: '# Welcome to Co.meta Support! 👋\n\nHow can I help you today? You can ask me about:\n\n- Creating and running tests\n- Browser configurations\n- Scheduling tests\n- Mobile testing\n- API testing',
        isUser: false,
        timestamp: new Date()
      });
      this.messagesSubject.next(messages);
      this.initialGreetingShown = true;
    }
  }

  public toggleChat(): void {
    const currentState = this.isOpenSubject.getValue();
    this.isOpenSubject.next(!currentState);
    this.store.dispatch(
      new Configuration.SetProperty('internal.chatbotOpen', !currentState)
    );
  }

  public closeChat(): void {
    if (this.isOpenSubject.getValue()) {
      this.isOpenSubject.next(false);
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotOpen', false)
      );
    }
  }

  public openChat(): void {
    if (!this.isOpenSubject.getValue()) {
      this.isOpenSubject.next(true);
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotOpen', true)
      );
    }
  }

  public addUserMessage(text: string): void {
    const messages = this.messagesSubject.getValue();
    messages.push({
      text,
      isUser: true,
      timestamp: new Date()
    });
    this.messagesSubject.next(messages);
  }

  public addBotMessage(text: string): void {
    const messages = this.messagesSubject.getValue();
    messages.push({
      text,
      isUser: false,
      timestamp: new Date()
    });
    this.messagesSubject.next(messages);
  }
  
  // Handle AI service errors
  private handleAIServiceError(error: any): void {
    console.error('AI service error:', error);
    this.aiServiceAvailable = false;
    
    // Add a helpful message to the user
    this.addBotMessage(
      "I'm sorry, but the AI service is currently unavailable. Our team has been notified of this issue. " +
      "In the meantime, you can try refreshing the page or trying again later."
    );
    this.isLoadingSubject.next(false);
  }

  // Generate a fallback response when AI services are unavailable
  private generateFallbackResponse(message: string): void {
    // Simple fallback response
    this.addBotMessage("I'm sorry, but I can't provide a detailed answer right now as the AI service is unavailable.");
    this.isLoadingSubject.next(false);
  }

  public handleUserMessage(message: string): void {
    if (!message.trim()) return;
    
    // Process commands
    const lowerCaseMessage = message.toLowerCase().trim();
        
    this.addUserMessage(message);
    this.isLoadingSubject.next(true);
    
    // Keep only the greeting responses
    if ((lowerCaseMessage === 'hello' || lowerCaseMessage === 'hi') && 
        this.messagesSubject.getValue().length <= 2) {
      // This is just a greeting after our initial welcome message
      setTimeout(() => {
        this.addBotMessage('Is there something specific you\'d like to know about Co.meta? I can help with test creation, execution, scheduling, and other platform features.');
        this.isLoadingSubject.next(false);
      }, 500);
      return;
    }
    
    // If AI service is known to be unavailable, use fallback immediately
    if (!this.aiServiceAvailable) {
      this.generateFallbackResponse(message);
      this.isLoadingSubject.next(false);
      return;
    }
    
    // Get current chat history
    const messages = this.messagesSubject.getValue();
    const history = messages.map(msg => ({
      text: msg.text,
      isUser: msg.isUser,
      timestamp: msg.timestamp
    }));
    
    const payload = {
      message: message,
      history: history.slice(-10)
    };
    
    this.http.post<ChatCompletionResponse>(
      `${this.base}api/chat/completion/`, 
      payload
    ).pipe(
      timeout(80000), // 80-seconds timeout for the entire process
      catchError(error => {
        this.handleAIServiceError(error);
        return of(null);
      })
    ).subscribe(response => {
      if (response) {
        if (response.success) {
          // Add the bot's response
          this.addBotMessage(response.message);
          
          // Reset AI service availability flag if it was previously marked as unavailable
          if (!this.aiServiceAvailable) {
            this.aiServiceAvailable = true;
          }
        } else {
          // Handle unsuccessful response
          this.addBotMessage("I'm sorry, I couldn't process your request. Please try again later.");
        }
      }
      this.isLoadingSubject.next(false);
    });
  }
}