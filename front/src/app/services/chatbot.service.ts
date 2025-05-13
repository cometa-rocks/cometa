import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { Configuration } from '../store/actions/config.actions';
import { API_BASE } from '../tokens';
import { catchError, timeout } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LogService } from './log.service';

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
  
  // Flag to track if AI feature is enabled as a BehaviorSubject
  private isAiFeatureEnabledSubject = new BehaviorSubject<boolean>(false);
  public isAiFeatureEnabled$ = this.isAiFeatureEnabledSubject.asObservable();
  
  // Getter to allow components to access the current value synchronously if needed
  get isAiFeatureEnabled(): boolean {
    return this.isAiFeatureEnabledSubject.getValue();
  }
  
  // Store the detected user language
  private userLanguage: string = 'en';
  
  // Supported languages mapping for Granite 3.2 LLM
  private supportedLanguages = {
    'en': 'English',
    'de': 'German',
    'es': 'Spanish',
    'fr': 'French',
    'ja': 'Japanese',
    'pt': 'Portuguese',
    'ar': 'Arabic',
    'cs': 'Czech',
    'it': 'Italian',
    'ko': 'Korean',
    'nl': 'Dutch',
    'zh': 'Chinese'
  };
  
  // Multilingual greetings
  private greetings = {
    'en': '# Welcome to Co.Meta Support! 👋\n\nHow can I help you today? You can ask me about:\n\n- Creating and running tests\n- Browser configurations\n- Scheduling tests\n- Mobile testing\n- API testing',
    'de': '# Willkommen beim Co.Meta Support! 👋\n\nWie kann ich Ihnen heute helfen? Sie können mich zu folgenden Themen befragen:\n\n- Erstellen und Ausführen von Tests\n- Browser-Konfigurationen\n- Testplanung\n- Mobile Tests\n- API-Tests',
    'es': '# ¡Bienvenido al soporte de Co.Meta! 👋\n\n¿Cómo puedo ayudarte hoy? Puedes preguntarme sobre:\n\n- Creación y ejecución de pruebas\n- Configuraciones de navegador\n- Programación de pruebas\n- Pruebas móviles\n- Pruebas de API',
    'fr': '# Bienvenue dans le support Co.Meta ! 👋\n\nComment puis-je vous aider aujourd\'hui ? Vous pouvez me poser des questions sur :\n\n- Création et exécution de tests\n- Configurations de navigateur\n- Planification des tests\n- Tests mobiles\n- Tests d\'API',
    'ja': '# Co.Metaサポートへようこそ！ 👋\n\n今日はどのようにお手伝いできますか？以下についてお尋ねいただけます：\n\n- テストの作成と実行\n- ブラウザの設定\n- テストのスケジューリング\n- モバイルテスト\n- APIテスト',
    'pt': '# Bem-vindo ao suporte da Co.Meta! 👋\n\nComo posso ajudá-lo hoje? Você pode me perguntar sobre:\n\n- Criação e execução de testes\n- Configurações de navegador\n- Agendamento de testes\n- Testes móveis\n- Testes de API',
    'ar': '# مرحباً بك في دعم Co.Meta! 👋\n\nكيف يمكنني مساعدتك اليوم؟ يمكنك أن تسألني عن:\n\n- إنشاء وتشغيل الاختبارات\n- إعدادات المتصفح\n- جدولة الاختبارات\n- اختبارات الجوال\n- اختبارات API',
    'cs': '# Vítejte v podpoře Co.Meta! 👋\n\nJak vám mohu dnes pomoci? Můžete se mě zeptat na:\n\n- Vytváření a spouštění testů\n- Konfigurace prohlížeče\n- Plánování testů\n- Mobilní testování\n- Testování API',
    'it': '# Benvenuto al supporto Co.Meta! 👋\n\nCome posso aiutarti oggi? Puoi chiedermi informazioni su:\n\n- Creazione ed esecuzione di test\n- Configurazioni del browser\n- Pianificazione dei test\n- Test mobili\n- Test API',
    'ko': '# Co.Meta 지원에 오신 것을 환영합니다! 👋\n\n오늘 어떻게 도와드릴까요? 다음에 대해 질문하실 수 있습니다:\n\n- 테스트 생성 및 실행\n- 브라우저 구성\n- 테스트 일정 관리\n- 모바일 테스트\n- API 테스트',
    'nl': '# Welkom bij Co.Meta Support! 👋\n\nHoe kan ik u vandaag helpen? U kunt me vragen stellen over:\n\n- Tests maken en uitvoeren\n- Browserconfiguraties\n- Tests plannen\n- Mobiel testen\n- API-testen',
    'zh': '# 欢迎使用 Co.Meta 支持！👋\n\n今天我能帮您什么？您可以询问我关于：\n\n- 创建和运行测试\n- 浏览器配置\n- 测试调度\n- 移动测试\n- API测试'
  };
  
  // AI disabled messages
  private aiDisabledMessages = {
    'en': '# AI Feature Not Available\n\nThis chatbot requires the Cometa AI feature to be enabled. Please contact your administrator to enable the AI feature in your subscription.',
    'de': '# KI-Funktion nicht verfügbar\n\nDieser Chatbot erfordert, dass die Cometa KI-Funktion aktiviert ist. Bitte kontaktieren Sie Ihren Administrator, um die KI-Funktion in Ihrem Abonnement zu aktivieren.',
    'es': '# Función de IA no disponible\n\nEste chatbot requiere que la función de IA de Cometa esté habilitada. Por favor, contacte a su administrador para habilitar la función de IA en su suscripción.',
    'fr': '# Fonctionnalité IA non disponible\n\nCe chatbot nécessite l\'activation de la fonctionnalité IA de Cometa. Veuillez contacter votre administrateur pour activer la fonctionnalité IA dans votre abonnement.',
    'ja': '# AI機能は利用できません\n\nこのチャットボットを使用するには、Cometa AI機能を有効にする必要があります。サブスクリプションでAI機能を有効にするには、管理者に連絡してください。',
    'pt': '# Recurso de IA não disponível\n\nEste chatbot requer que o recurso de IA do Cometa esteja ativado. Entre em contato com seu administrador para ativar o recurso de IA em sua assinatura.',
    'ar': '# ميزة الذكاء الاصطناعي غير متوفرة\n\nيتطلب روبوت الدردشة هذا تمكين ميزة الذكاء الاصطناعي من Cometa. يرجى الاتصال بالمسؤول لتمكين ميزة الذكاء الاصطناعي في اشتراكك.',
    'cs': '# Funkce AI není k dispozici\n\nTento chatbot vyžaduje, aby byla povolena funkce Cometa AI. Kontaktujte prosím svého správce, aby povolil funkci AI ve vašem předplatném.',
    'it': '# Funzionalità AI non disponibile\n\nQuesto chatbot richiede che la funzionalità AI di Cometa sia abilitata. Contatta il tuo amministratore per abilitare la funzionalità AI nel tuo abbonamento.',
    'ko': '# AI 기능을 사용할 수 없습니다\n\n이 챗봇은 Cometa AI 기능이 활성화되어야 합니다. 구독에서 AI 기능을 활성화하려면 관리자에게 문의하세요.',
    'nl': '# AI-functie niet beschikbaar\n\nVoor deze chatbot moet de Cometa AI-functie zijn ingeschakeld. Neem contact op met uw beheerder om de AI-functie in uw abonnement in te schakelen.',
    'zh': '# AI 功能不可用\n\n此聊天机器人需要启用 Cometa AI 功能。请联系您的管理员在您的订阅中启用 AI 功能。'
  };

  constructor(
    private http: HttpClient,
    private store: Store,
    private _api: ApiService,
    private log: LogService,
    @Inject(API_BASE) public base: string
  ) {
    // Detect user's browser language
    this.detectUserLanguage();
    
    // Check if AI features are enabled
    this.checkAiFeatureEnabled();
    
    // Subscribe to store changes for chatbot state
    this.store.select(state => state.config.internal.chatbotOpen)
      .subscribe(isOpen => {
        if (isOpen !== undefined) {
          this.isOpenSubject.next(isOpen);
        }
      });
  }
  
  // Detect user's browser language and match it to supported languages
  private detectUserLanguage(): void {
    let browserLang = navigator.language || navigator['userLanguage'] || 'en';
    
    // Take only the language code part (e.g., 'en-US' -> 'en')
    browserLang = browserLang.split('-')[0].toLowerCase();
    
    // Check if the language is supported
    if (this.supportedLanguages[browserLang]) {
      this.userLanguage = browserLang;
    } else {
      // Default to English if not supported
      this.userLanguage = 'en';
    }
    
    this.log.msg('1', `Detected user language: ${this.userLanguage} (${this.supportedLanguages[this.userLanguage]})`, 'chatbot');
  }
  
  // Check if AI features are enabled in Cometa
  private checkAiFeatureEnabled(): void {
    this._api.getCometaConfigurations().subscribe(res => {
      const aiConfig = res.find((item: any) => item.configuration_name === 'COMETA_FEATURE_AI_ENABLED');
      if (aiConfig) {
        const enabled = aiConfig.configuration_value.toLowerCase() === 'true';
        this.isAiFeatureEnabledSubject.next(enabled);
        // Initialize with welcome message after we know AI status
        this.addInitialGreeting();
      } else {
        this.isAiFeatureEnabledSubject.next(false);
        this.addInitialGreeting();
      }
    }, error => {
      this.log.msg('2', `Error loading AI configuration: ${error}`, 'chatbot');
      this.isAiFeatureEnabledSubject.next(false);
      this.addInitialGreeting();
    });
  }

  // Add initial greeting message in the user's language
  private addInitialGreeting(): void {
    if (!this.initialGreetingShown) {
      const messages = this.messagesSubject.getValue();
      
      if (!this.isAiFeatureEnabled) {
        // Show AI feature disabled message in the user's language
        messages.push({
          text: this.aiDisabledMessages[this.userLanguage] || this.aiDisabledMessages['en'],
          isUser: false,
          timestamp: new Date()
        });
      } else {
        // Show normal welcome message in the user's language
        messages.push({
          text: this.greetings[this.userLanguage] || this.greetings['en'],
          isUser: false,
          timestamp: new Date()
        });
      }
      
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
    this.log.msg('2', `AI service error: ${error}`, 'chatbot');
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
    
    // If AI feature is not enabled, don't process the message or show it in the chat
    if (!this.isAiFeatureEnabled) {
      return;
    }
    
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