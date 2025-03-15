import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { Configuration } from '../store/actions/config.actions';
import { API_BASE } from '../tokens';
import { RAGService, RAGQueryResponse } from './rag.service';
import { catchError, timeout } from 'rxjs/operators';

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  // Optional field for RAG debug info
  ragInfo?: {
    documentsUsed: number;
    sources: string[];
  };
}

export interface ChatCompletionResponse {
  message: string;
  success: boolean;
  rag_debug?: {
    context_used: boolean;
    document_count: number;
    documents: Array<{
      content_preview: string;
      metadata: any;
      relevance_score: number;
    }>;
  };
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
  
  // RAG settings - always use RAG but debug can be toggled programmatically
  private useRag = true; // Always true now
  private showRagDebug = false;

  // AI service availability tracking
  private aiServiceAvailable = true;

  constructor(
    private http: HttpClient,
    private store: Store,
    private ragService: RAGService,
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
      
    // Get debug setting from store if available
    this.store.select(state => state.config.internal.chatbotShowRagDebug)
      .subscribe(showRagDebug => {
        if (showRagDebug !== undefined) {
          this.showRagDebug = showRagDebug;
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

  public addBotMessage(text: string, ragInfo?: { documentsUsed: number; sources: string[] }): void {
    const messages = this.messagesSubject.getValue();
    messages.push({
      text,
      isUser: false,
      timestamp: new Date(),
      ragInfo
    });
    this.messagesSubject.next(messages);
  }
  
  // Method for programmatic control of RAG debug info
  public setRagDebugMode(enabled: boolean): void {
    this.showRagDebug = enabled;
    this.store.dispatch(
      new Configuration.SetProperty('internal.chatbotShowRagDebug', enabled)
    );
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
    
    // Handle debug commands
    if (lowerCaseMessage === '/debug on') {
      this.showRagDebug = true;
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotShowRagDebug', true)
      );
      this.addUserMessage(message);
      this.addBotMessage('Debug information will now be shown with responses.');
      return;
    } else if (lowerCaseMessage === '/debug off') {
      this.showRagDebug = false;
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotShowRagDebug', false)
      );
      this.addUserMessage(message);
      this.addBotMessage('Debug information will be hidden.');
      return;
    } 
    // Handle RAG commands
    else if (lowerCaseMessage === '/rag on' || lowerCaseMessage === '/rag enable') {
      this.useRag = true;
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotUseRag', true)
      );
      this.addUserMessage(message);
      this.addBotMessage('RAG system is now enabled. Responses will be enhanced with relevant documentation.');
      return;
    } else if (lowerCaseMessage === '/rag off' || lowerCaseMessage === '/rag disable') {
      this.useRag = false;
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotUseRag', false)
      );
      this.addUserMessage(message);
      this.addBotMessage('RAG system is now disabled. Responses will not include documentation context.');
      return;
    } else if (lowerCaseMessage === '/rag debug on') {
      this.showRagDebug = true;
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotShowRagDebug', true)
      );
      this.addUserMessage(message);
      this.addBotMessage('RAG debug information will now be shown with responses.');
      return;
    } else if (lowerCaseMessage === '/rag debug off') {
      this.showRagDebug = false;
      this.store.dispatch(
        new Configuration.SetProperty('internal.chatbotShowRagDebug', false)
      );
      this.addUserMessage(message);
      this.addBotMessage('RAG debug information will be hidden.');
      return;
    }
    
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
    
    // First query the RAG system to get relevant context
    if (this.useRag) {
      this.ragService.queryRAG(message).pipe(
        timeout(10000), // Add a 10-second timeout
        catchError(error => {
          console.warn('RAG service error or timeout:', error);
          // If RAG fails, continue without context
          return of({ 
            success: false, 
            error: 'RAG service unavailable',
            data: { query: message, results: [], rag_available: false }
          });
        })
      ).subscribe(ragResponse => {
        // Now call the chat completion API with the RAG context if available
        let payload: any = {
          message: message,
          history: history.slice(-10), // Only send the last 10 messages for context
          include_rag_debug: this.showRagDebug // Include the debug flag in the request
        };
        
        // Add RAG context if available
        if (ragResponse.success && ragResponse.data && ragResponse.data.rag_available && 
            ragResponse.data.results && ragResponse.data.results.length > 0) {
          // Format RAG context to include in the request
          const ragContext = ragResponse.data.results.map(result => result.text).join('\n\n');
          payload.rag_context = ragContext;
        }
        
        this.http.post<ChatCompletionResponse>(
          `${this.base}api/chat/completion/`, 
          payload
        ).pipe(
          timeout(20000), // Add a 20-second timeout
          catchError(error => {
            this.handleAIServiceError(error);
            return of(null);
          })
        ).subscribe(response => {
          if (response) {
            if (response.success) {
              // Process RAG debug info if available
              let ragInfo: { documentsUsed: number; sources: string[] } | undefined;
              
              if (response.rag_debug && this.showRagDebug) {
                const sources = response.rag_debug.documents.map(doc => {
                  const metadata = doc.metadata || {};
                  return metadata.title || metadata.source || 'Unknown source';
                });
                
                ragInfo = {
                  documentsUsed: response.rag_debug.document_count || 0,
                  sources: sources
                };
              }
              
              // Add the bot's response
              this.addBotMessage(response.message, ragInfo);
              
              // Reset AI service availability flag if it was previously marked as unavailable
              if (!this.aiServiceAvailable) {
                this.aiServiceAvailable = true;
              }
            } else {
              // Handle unsuccessful response
              this.addBotMessage("I'm sorry, I couldn't process your request. Please try again later.");
            }
          }
          // Loading state is handled in the error handler if there's an error
          this.isLoadingSubject.next(false);
        });
      });
    } else {
      // Direct chat completion without RAG
      this.http.post<ChatCompletionResponse>(
        `${this.base}api/chat/completion/`, 
        {
          message: message,
          history: history.slice(-10),
          include_rag_debug: this.showRagDebug // Include the debug flag in the request
        }
      ).pipe(
        timeout(20000), // Add a 20-second timeout
        catchError(error => {
          this.handleAIServiceError(error);
          return of(null);
        })
      ).subscribe(response => {
        if (response) {
          if (response.success) {
            this.addBotMessage(response.message);
            // Reset AI service availability flag if it was previously marked as unavailable
            if (!this.aiServiceAvailable) {
              this.aiServiceAvailable = true;
            }
          } else {
            this.addBotMessage("I'm sorry, I couldn't process your request. Please try again later.");
          }
        }
        this.isLoadingSubject.next(false);
      });
    }
  }

  private generateCacheKey(message: string): string {
    // TODO: Simple cache key generation - normalize the message
    return message.toLowerCase().trim();
  }
}