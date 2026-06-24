import React, { Component } from 'react';
import wsService from '../../services/websocket';

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '20px',
  background: '#f5f0e8'
};

const titleStyle = {
  fontSize: '36px',
  color: '#5a4a2a',
  marginBottom: '40px',
  fontWeight: 'bold'
};

const sectionTitleStyle = {
  fontSize: '18px',
  color: '#5a4a2a',
  marginBottom: '16px',
  fontWeight: 'bold',
  borderBottom: '2px solid #e8c97a',
  paddingBottom: '8px'
};

const cardStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '40px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  textAlign: 'center',
  maxWidth: '420px',
  width: '100%',
  marginBottom: '20px'
};

const innerSection = {
  marginBottom: '24px',
  padding: '16px',
  background: '#faf8f4',
  borderRadius: '8px'
};

const inputStyle = {
  padding: '12px 16px',
  fontSize: '16px',
  border: '2px solid #5a4a2a',
  borderRadius: '8px',
  width: '100%',
  boxSizing: 'border-box',
  marginBottom: '12px',
  outline: 'none'
};

const buttonStyle = {
  padding: '12px 24px',
  fontSize: '16px',
  border: '2px solid #5a4a2a',
  borderRadius: '8px',
  background: '#5a4a2a',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 'bold',
  margin: '6px',
  minWidth: '140px'
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: 'transparent',
  color: '#5a4a2a'
};

const statusStyle = {
  marginTop: '16px',
  padding: '12px',
  borderRadius: '8px',
  fontSize: '14px'
};

export default class Lobby extends Component {
  constructor(props) {
    super(props);
    this.state = {
      roomId: '',
      status: '',
      statusType: 'info',
      connected: false
    };
    this.unsubscribers = [];
  }

  componentDidMount() {
    this.unsubscribers.push(wsService.on('connected', () => {
      this.setState({ connected: true });
      this.setStatus('已连接到服务器', 'success');
    }));

    this.unsubscribers.push(wsService.on('disconnected', () => {
      this.setState({ connected: false });
      this.setStatus('与服务器断开连接，正在重连...', 'error');
    }));

    this.unsubscribers.push(wsService.on('room_joined', (msg) => {
      this.setState({ createdRoomId: msg.roomId });
      // Store room info for reconnection on refresh
      sessionStorage.setItem('gobang_roomId', msg.roomId);
      sessionStorage.setItem('gobang_player', msg.player);
      sessionStorage.setItem('gobang_token', msg.token);
      // Navigate to game page
      this.props.history.push(`/game/${msg.roomId}`);
    }));

    this.unsubscribers.push(wsService.on('error', (msg) => {
      this.setStatus(msg.message || '发生错误', 'error');
    }));

    wsService.connect();
  }

  componentWillUnmount() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  setStatus(message, type = 'info') {
    this.setState({ status: message, statusType: type });
  }

  handleCreateRoom = () => {
    if (!this.state.connected) {
      this.setStatus('未连接到服务器', 'error');
      return;
    }
    wsService.send({ type: 'create_room' });
    this.setStatus('正在创建房间...', 'info');
  }

  handleJoinRoom = () => {
    if (!this.state.connected) {
      this.setStatus('未连接到服务器', 'error');
      return;
    }
    const roomId = this.state.roomId.trim();
    if (!roomId) {
      this.setStatus('请输入房间号', 'error');
      return;
    }
    wsService.send({ type: 'join_room', roomId });
    this.setStatus('正在加入房间...', 'info');
  };

  startLocalGame = (mode) => {
    // Clear any online session data
    sessionStorage.removeItem('gobang_roomId');
    sessionStorage.removeItem('gobang_player');
    sessionStorage.removeItem('gobang_token');
    // Navigate to local game page
    this.props.history.push(`/game?mode=${mode}`);
  };

  render() {
    const { roomId, connected, status, statusType } = this.state;

    const statusBg = {
      info: '#e3f2fd',
      error: '#ffebee',
      success: '#e8f5e9'
    };
    const statusColor = {
      info: '#1565c0',
      error: '#c62828',
      success: '#2e7d32'
    };

    return (
      <div style={containerStyle}>
        <div style={titleStyle}>🐼 五子棋</div>

        {/* 本地游戏 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>🎮 本地游戏</div>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => this.startLocalGame('pvp')}
              style={buttonStyle}
            >
              👥 人人对战
            </button>
            <button
              onClick={() => this.startLocalGame('pve')}
              style={secondaryButtonStyle}
            >
              🤖 人机对战
            </button>
          </div>
        </div>

        {/* 在线对战 */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>🌐 在线对战</div>

          {/* Connection indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? '#4caf50' : '#f44336'
            }} />
            <span style={{ color: '#666', fontSize: '13px' }}>
              {connected ? '已连接到服务器' : '未连接到服务器'}
            </span>
          </div>

          <div style={innerSection}>
            <div style={{ fontSize: '14px', color: '#5a4a2a', marginBottom: '12px', fontWeight: 'bold' }}>
              创建新房间，邀请好友对战
            </div>
            <button
              onClick={this.handleCreateRoom}
              style={buttonStyle}
              disabled={!connected}
            >
              🏠 创建房间
            </button>
          </div>

          <div style={{ color: '#ccc', fontSize: '14px', margin: '4px 0' }}>— 或 —</div>

          <div style={innerSection}>
            <div style={{ fontSize: '14px', color: '#5a4a2a', marginBottom: '12px', fontWeight: 'bold' }}>
              输入好友的房间号加入
            </div>
            <input
              type="text"
              placeholder="输入房间号"
              value={roomId}
              onChange={(e) => this.setState({ roomId: e.target.value })}
              style={inputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') this.handleJoinRoom(); }}
            />
            <button
              onClick={this.handleJoinRoom}
              style={secondaryButtonStyle}
              disabled={!connected}
            >
              🔑 加入房间
            </button>
          </div>

          {/* Status message */}
          {status && (
            <div style={{
              ...statusStyle,
              background: statusBg[statusType],
              color: statusColor[statusType]
            }}>
              {status}
            </div>
          )}
        </div>
      </div>
    );
  }
}