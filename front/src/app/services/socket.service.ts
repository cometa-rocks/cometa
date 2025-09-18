import { Injectable, Inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from 'app/tokens';
import { Select, Store } from '@ngxs/store';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable, Subscription, Subject } from 'rxjs';
import { skip } from 'rxjs/operators';
import { DataDriven } from '@store/actions/datadriven.actions';
import { MobileWebSockets } from '@store/actions/mobile.actions';

@Injectable()
export class SocketService {
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

  /** Browser-use logs subject for external services */
  browserUseLog$ = new Subject<any>();

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
    this.socket.on('browser_use_log', this.onBrowserUseLogReceived.bind(this));
  }

  /**
   * Executed whenever the WebSocket server emits an event with 'message' type
   * @param {any} data
   */
  onMessageReceived(data: any) {
    if (this.logWebsockets) console.log('[WEBSOCKET] Raw message received:', data);

    // Handle specific WebSocket message types that need conversion to NGXS actions
    const action = this.convertWebSocketMessageToAction(data);

    this._store.dispatch(action);
  }

  /**
   * Executed whenever the WebSocket server emits browser-use log events
   * @param {any} data
   */
  onBrowserUseLogReceived(data: any) {
    if (this.logWebsockets) console.log('[WEBSOCKET] Browser-use log received:', data);
    this.browserUseLog$.next(data);
  }

  /**
   * Converts WebSocket messages to proper NGXS actions
   * @param {any} data Raw WebSocket message data
   * @returns Action object for NGXS store
   */
  private convertWebSocketMessageToAction(data: any): any {
    // Validate data exists and has a type property
    if (!data || !data.type) {
      // Return the original data as-is for backward compatibility
      return data;
    }

    // Handle DataDriven StatusUpdate messages
    if (data.type === '[WebSockets] DataDrivenStatusUpdate') {
      return new DataDriven.StatusUpdate(
        data.run_id,
        data.running,
        data.status,
        data.total,
        data.ok,
        data.fails,
        data.skipped,
        data.execution_time,
        data.pixel_diff
      );
    }
    
    // Handle Mobile WebSocket messages
    if (data.type && data.type.startsWith('[MobileWebSockets]')) {
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
          return data;
      }
    }
    
    // For all other message types, return the data as-is
    // This maintains backward compatibility with existing WebSocket actions
    return data;
  }

  /**
   * Executed whenever the user has been connected to the server
   */
  onConnection() {
    this.connectionStatus$.next(true);
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
}
