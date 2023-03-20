import { Injectable, Inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from 'app/tokens';
import { Select, Store } from '@ngxs/store';
import { SelectSnapshot } from '@ngxs-labs/select-snapshot';
import { CustomSelectors } from '@others/custom-selectors';
import { UserState } from '@store/user.state';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';

@Injectable()
export class SocketService {

  /** Whether or not to log websockets into Console */
  @SelectSnapshot(CustomSelectors.GetConfigProperty('logWebsockets')) logWebsockets !: boolean;
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
  ) { }

  Init() {
    // Create connection to WebSocket Server
    this.socket = io(`${this.socketURI}`, {
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: Infinity,
      forceNew: false,
      transports: ['websocket', 'polling'],
      auth: {
        user: this.user
      }
    });
    // Bind listeners to socket
    this.socket.on('connect', this.onConnection.bind(this))
    this.socket.on('disconnect', this.onDisconnection.bind(this))
    this.socket.on('message', this.onMessageReceived.bind(this));
  }

  /**
   * Executed whenever the WebSocket server emits an event with 'message' type
   * @param {any} data
   */
  onMessageReceived(data: any) {
    if (this.logWebsockets) console.log(data);
    this._store.dispatch( data )
  }

  /**
   * Executed whenever the user has been connected to the server
   */
  onConnection() {
    this.connectionStatus$.next(true);
    // Clear previous subscription to user changes if found
    this.clearUserSubscription();
    this.userSubscription = this.user$.pipe(
      // Skip initial store value, get only changes
      skip(1)
    ).subscribe(user => this.updateUserSocket(user));
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
