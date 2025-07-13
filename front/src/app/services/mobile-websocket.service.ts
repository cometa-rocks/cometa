import { Injectable, Inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from 'app/tokens';
import { Select, Store } from '@ngxs/store';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { MobileWebSockets } from '@store/actions/mobile.actions';

@Injectable()
export class MobileWebSocketService {
  /** Whether or not to log websockets into Console */
  @SelectSnapshot(CustomSelectors.GetConfigProperty('logWebsockets'))
  logWebsockets!: boolean;
  /** Observable User object from user.state.ts */
  @Select(UserState) user$: Observable<UserInfo>;
  /** User object from user.state.ts */
  @SelectSnapshot(UserState) user: UserInfo;

  /** Subscription holder for user changes */
  userSubscription: Subscription;

  /** Tells to front if the WebSocket Connection is alive or not */
  connectionStatus$ = new BehaviorSubject<boolean>(false);

  /** Holds the WebSocket connection */
  socket: Socket;

  constructor(
    @Inject(SOCKET_URL) private socketURI: string,
    private _store: Store
  ) {}

  Init() {
    // Create connection to WebSocket Server
    this.socket = io(`${this.socketURI}`, {
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: Infinity,
      auth: {
        user: this.user,
      },
    });
    // Bind listeners to socket
    this.socket.on('connect', this.onConnection.bind(this));
    this.socket.on('disconnect', this.onDisconnection.bind(this));
    this.socket.on('message', this.onMessageReceived.bind(this));
  }

  /**
   * Executed whenever the WebSocket server emits an event with 'message' type
   * @param {any} data
   */
  onMessageReceived(data: any) {
    if (this.logWebsockets) console.log('[MOBILE WEBSOCKET] Raw message received:', data);
    
    // Handle mobile-specific WebSocket message types
    const action = this.convertMobileWebSocketMessageToAction(data);
    
    if (action) {
      this._store.dispatch(action);
    }
  }

  /**
   * Converts mobile WebSocket messages to proper NGXS actions
   * @param {any} data Raw WebSocket message data
   * @returns Action object for NGXS store or null if not a mobile message
   */
  private convertMobileWebSocketMessageToAction(data: any): any {
    // Handle mobile WebSocket message types
    switch (data.type) {
      case '[MobileWebSockets] Container Status Update':
        return new MobileWebSockets.ContainerStatusUpdate(data.containerUpdate);
      
      case '[MobileWebSockets] Container Shared Update':
        return new MobileWebSockets.ContainerSharedUpdate(data.container_id, data.shared);
      
      case '[MobileWebSockets] Container Started':
        return new MobileWebSockets.ContainerStarted(data.container_id, data.hostname);
      
      case '[MobileWebSockets] Container Stopped':
        return new MobileWebSockets.ContainerStopped(data.container_id);
      
      case '[MobileWebSockets] Container Terminated':
        return new MobileWebSockets.ContainerTerminated(data.container_id);
      
      case '[MobileWebSockets] Container APK Update':
        return new MobileWebSockets.ContainerApkUpdate(data.container_id, data.apk_file);
      
      default:
        // Not a mobile message, return null
        return null;
    }
  }

  /**
   * Executed whenever the user has been connected to the server
   */
  onConnection() {
    this.connectionStatus$.next(true);
    console.log('[MOBILE WEBSOCKET] Connected to server');
    
    // Clear previous subscription to user changes if found
    this.clearUserSubscription();
    this.userSubscription = this.user$
      .pipe(
        // Skip initial store value, get only changes
        skip(1)
      )
      .subscribe(user => this.updateUserSocket(user));
  }

  /**
   * Executed whenever the user has been disconnected from the server
   */
  onDisconnection() {
    this.connectionStatus$.next(false);
    console.log('[MOBILE WEBSOCKET] Disconnected from server');
    this.clearUserSubscription();
  }

  /**
   * Removes the user changes subscription if found
   */
  clearUserSubscription() {
    if (this.userSubscription) this.userSubscription.unsubscribe();
  }

  /**
   * Emits an event to the server to perform a user object update
   * @param {UserInfo} user Information of user
   */
  updateUserSocket(user: UserInfo) {
    if (user && this.socket && this.socket.connected) {
      this.socket.emit('updateUser', user);
    }
  }

  /**
   * Initialize mobile WebSocket connection
   */
  initializeMobileWebSocket() {
    this._store.dispatch(new MobileWebSockets.InitializeMobileWebSocket());
  }

  /**
   * Cleanup mobile WebSocket connection
   */
  cleanupMobileWebSocket() {
    this._store.dispatch(new MobileWebSockets.CleanupMobileWebSocket());
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
