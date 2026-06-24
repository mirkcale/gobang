import React, { Component } from 'react';
import { connect } from 'react-redux';
import ChessBoard from '../../components/ChessBoard';
import wsService from '../../services/websocket';

// Helper to parse query string
function getQueryParam(search, key) {
  const params = new URLSearchParams(search);
  return params.get(key);
}

class App extends Component {
  constructor(props) {
    super(props);
    const roomId = props.match.params.roomId || null;
    const mode = getQueryParam(props.location.search, 'mode');
    this.state = {
      roomId,
      myPlayer: null,
      gameState: null,
      opponentConnected: false,
      gameStarted: false,
      onlineMode: !!roomId,
      localMode: mode || 'pvp', // 'pvp' or 'pve'
      statusText: roomId ? '正在重新连接...' : '等待对手加入...',
      reconnecting: !!roomId
    };
    this.unsubscribers = [];
  }

  componentDidMount() {
    const { roomId } = this.state;

    // Set up WebSocket event listeners
    this.setupListeners();

    // Ensure WebSocket is connected
    wsService.connect();

    // If we have a roomId, try to reconnect
    if (roomId) {
      const token = sessionStorage.getItem('gobang_token');
      const player = sessionStorage.getItem('gobang_player');

      if (token && player) {
        this.setState({ myPlayer: player });
        // Wait for WebSocket to connect, then rejoin
        const tryRejoin = () => {
          if (wsService.isConnected) {
            wsService.send({ type: 'rejoin_room', roomId, token });
          } else {
            // Wait and retry
            const unsub = wsService.on('connected', () => {
              unsub();
              wsService.send({ type: 'rejoin_room', roomId, token });
            });
          }
        };
        tryRejoin();
      }
    }
  }

  setupListeners() {
    // Room created/joined (initial join)
    this.unsubscribers.push(wsService.on('room_joined', (msg) => {
      sessionStorage.setItem('gobang_roomId', msg.roomId);
      sessionStorage.setItem('gobang_player', msg.player);
      sessionStorage.setItem('gobang_token', msg.token);
      this.setState({
        roomId: msg.roomId,
        myPlayer: msg.player,
        onlineMode: true,
        gameState: msg.gameState,
        gameStarted: msg.gameStarted || false,
        opponentConnected: msg.gameStarted || false,
        reconnecting: false,
        statusText: msg.gameStarted ? '游戏开始！' : '等待对手加入...'
      });
    }));

    // Reconnected after refresh
    this.unsubscribers.push(wsService.on('room_rejoined', (msg) => {
      sessionStorage.setItem('gobang_token', msg.token);
      this.setState({
        roomId: msg.roomId,
        myPlayer: msg.player,
        onlineMode: true,
        gameState: msg.gameState,
        gameStarted: msg.gameStarted || false,
        opponentConnected: msg.gameStarted || false,
        reconnecting: false,
        statusText: '已重新连接！'
      });
    }));

    this.unsubscribers.push(wsService.on('opponent_joined', (msg) => {
      this.setState({
        opponentConnected: true,
        statusText: '对手已加入！'
      });
    }));

    this.unsubscribers.push(wsService.on('game_start', (msg) => {
      this.setState({
        gameStarted: true,
        opponentConnected: true,
        gameState: msg.gameState,
        statusText: msg.message || '游戏开始！黑棋先手'
      });
    }));

    this.unsubscribers.push(wsService.on('move_made', (msg) => {
      this.setState({ gameState: msg.gameState });
    }));

    this.unsubscribers.push(wsService.on('game_reset', (msg) => {
      this.setState({ gameState: msg.gameState });
    }));

    // Opponent disconnected (still in grace period)
    this.unsubscribers.push(wsService.on('opponent_disconnected', (msg) => {
      this.setState({
        opponentConnected: false,
        statusText: msg.message || '对手已断开连接，等待重连...'
      });
    }));

    // Opponent reconnected
    this.unsubscribers.push(wsService.on('opponent_reconnected', (msg) => {
      this.setState({
        opponentConnected: true,
        gameStarted: true,
        statusText: '对手已重新连接！'
      });
    }));

    // Opponent left permanently
    this.unsubscribers.push(wsService.on('opponent_left', (msg) => {
      this.setState({
        opponentConnected: false,
        gameStarted: false,
        statusText: msg.message || '对手已断开连接'
      });
    }));
  }

  componentWillUnmount() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  handleLeaveRoom = () => {
    wsService.disconnect();
    sessionStorage.removeItem('gobang_roomId');
    sessionStorage.removeItem('gobang_player');
    sessionStorage.removeItem('gobang_token');
    this.props.history.push('/');
  }

  render() {
    const { roomId, myPlayer, onlineMode, gameStarted, opponentConnected, gameState, statusText, reconnecting, localMode } = this.state;

    if (reconnecting) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ color: '#5a4a2a' }}>正在重新连接房间 {roomId}...</h2>
        </div>
      );
    }

    return (
      <div>
        {onlineMode && roomId && (
          <div style={{
            textAlign: 'center',
            padding: '10px',
            background: '#e8c97a',
            borderBottom: '2px solid #5a4a2a'
          }}>
            <span style={{ color: '#5a4a2a', fontWeight: 'bold', marginRight: '16px' }}>
              房间号: {roomId}
            </span>
            {myPlayer && (
              <span style={{
                color: myPlayer === 'black' ? '#333' : '#999',
                fontWeight: 'bold',
                marginRight: '16px'
              }}>
                你执 {myPlayer === 'black' ? '黑棋' : '白棋'}
              </span>
            )}
            {!gameStarted && !reconnecting && (
              <span style={{ color: '#f44336' }}>{statusText}</span>
            )}
          </div>
        )}
        <ChessBoard
          dispatch={this.props.dispatch}
          golang={this.props.state.golang}
          onlineMode={onlineMode}
          roomId={roomId}
          myPlayer={myPlayer}
          onlineGameState={gameState}
          gameStarted={gameStarted}
          opponentConnected={opponentConnected}
          localMode={localMode}
          onLeaveRoom={this.handleLeaveRoom}
        />
      </div>
    );
  }
}

function select(state) {
  return { state };
}

export default connect(select)(App);