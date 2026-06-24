import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GRID_COUNT, checkWin, createInitialGameState, isPositionOccupied, isInBounds } from '@gobang/shared';

const PORT = process.env.PORT || 3001;

// Room management
const rooms = new Map();

function createRoom() {
  const roomId = uuidv4().slice(0, 8);
  rooms.set(roomId, {
    id: roomId,
    players: [], // [{ ws, player: 'black'|'white', token }]
    gameState: createInitialGameState()
  });
  return roomId;
}

function joinRoom(roomId, ws) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.players.length >= 2) return { error: '房间已满' };

  const player = room.players.length === 0 ? 'black' : 'white';
  const token = uuidv4(); // token for reconnection
  room.players.push({ ws, player, token });

  // Send room info to the joining player
  const gameStarted = room.players.length === 2;
  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId,
    player,
    token,
    gameState: room.gameState,
    gameStarted
  }));

  // Notify other player(s)
  broadcastToRoom(room, {
    type: 'opponent_joined',
    player
  }, ws);

  // If both players are ready, start the game
  if (room.players.length === 2) {
    broadcastToRoom(room, {
      type: 'game_start',
      message: '游戏开始！黑棋先手',
      gameState: room.gameState
    });
  }

  return { success: true, player, token };
}

function broadcastToRoom(room, message, excludeWs = null) {
  const data = JSON.stringify(message);
  for (const p of room.players) {
    if (p.ws !== excludeWs && p.ws.readyState === 1) {
      p.ws.send(data);
    }
  }
}

function handleMove(roomId, ws, position) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.gameState.gameOver) return { error: '游戏已结束' };

  // Find the player
  const playerEntry = room.players.find(p => p.ws === ws);
  if (!playerEntry) return { error: '你不是房间中的玩家' };

  const player = playerEntry.player;
  if (player !== room.gameState.player) return { error: '还没轮到你下棋' };

  const [x, y] = position;
  if (!isInBounds(x, y)) return { error: '超出棋盘范围' };

  // Check if position is already occupied
  const container = room.gameState.container;
  if (isPositionOccupied(x, y, container)) {
    return { error: '该位置已有棋子' };
  }

  // Place the piece
  container[player] = [...container[player], [x, y]];

  // Check win
  const won = checkWin(x, y, player, container[player]);

  // Switch player
  room.gameState.player = player === 'black' ? 'white' : 'black';

  if (won) {
    room.gameState.gameOver = true;
    room.gameState.winner = player;
  }

  // Broadcast the move to all players
  broadcastToRoom(room, {
    type: 'move_made',
    position,
    player,
    gameState: room.gameState
  });

  return { success: true };
}

function handleReset(roomId, ws) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };

  room.gameState = createInitialGameState();

  broadcastToRoom(room, {
    type: 'game_reset',
    gameState: room.gameState
  });

  return { success: true };
}

/**
 * Rejoin a room after disconnect. Uses player token for authentication.
 */
function handleRejoin(roomId, ws, playerToken) {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在或已过期' };

  // Find the disconnected player by token
  const playerEntry = room.players.find(p => p.token === playerToken);
  if (!playerEntry) {
    // If the room has an open slot (1 player), allow joining as the missing color
    if (room.players.length < 2) {
      const occupied = room.players.map(p => p.player);
      const player = occupied.includes('black') ? 'white' : 'black';
      const token = uuidv4();
      room.players.push({ ws, player, token });
      broadcastToRoom(room, {
        type: 'opponent_reconnected',
        player,
        gameState: room.gameState
      });
      return { success: true, player, token, gameState: room.gameState };
    }
    return { error: '无法重新加入房间' };
  }

  // Reconnect: update the WebSocket reference
  playerEntry.ws = ws;

  // Send current game state to the reconnecting player
  ws.send(JSON.stringify({
    type: 'room_rejoined',
    roomId,
    player: playerEntry.player,
    token: playerEntry.token,
    gameState: room.gameState,
    gameStarted: room.players.length === 2 && room.players.every(p => p.ws.readyState === 1)
  }));

  // Notify the other player
  broadcastToRoom(room, {
    type: 'opponent_reconnected',
    player: playerEntry.player
  }, ws);

  return { success: true, player: playerEntry.player, token: playerEntry.token };
}

// Cleanup disconnected players and empty rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    // Remove players whose WebSocket has been closed for more than 60 seconds
    const disconnectedPlayers = room.players.filter(p => p.ws.readyState !== 1);
    for (const p of disconnectedPlayers) {
      if (!p.disconnectedAt) {
        p.disconnectedAt = now;
      } else if (now - p.disconnectedAt > 60000) {
        // 60 second grace period expired, remove the player
        room.players = room.players.filter(rp => rp !== p);
        broadcastToRoom(room, {
          type: 'opponent_left',
          message: '对手已断开连接超时'
        });
      }
    }
    // Delete empty rooms
    const activePlayers = room.players.filter(p => p.ws.readyState === 1);
    const pendingPlayers = room.players.filter(p => p.ws.readyState !== 1 && (!p.disconnectedAt || now - p.disconnectedAt <= 60000));
    if (activePlayers.length === 0 && pendingPlayers.length === 0) {
      rooms.delete(id);
    }
  }
}, 30000);

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let currentPlayerToken = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: '无效的消息格式' }));
      return;
    }

    switch (msg.type) {
      case 'create_room': {
        const roomId = createRoom();
        currentRoomId = roomId;
        const result = joinRoom(roomId, ws);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        } else {
          currentPlayerToken = result.token;
        }
        break;
      }
      case 'join_room': {
        const result = joinRoom(msg.roomId, ws);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        } else {
          currentRoomId = msg.roomId;
          currentPlayerToken = result.token;
        }
        break;
      }
      case 'rejoin_room': {
        const result = handleRejoin(msg.roomId, ws, msg.token);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        } else {
          currentRoomId = msg.roomId;
          currentPlayerToken = result.token;
        }
        break;
      }
      case 'make_move': {
        if (!currentRoomId) {
          ws.send(JSON.stringify({ type: 'error', message: '你不在房间中' }));
          return;
        }
        const result = handleMove(currentRoomId, ws, msg.position);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        }
        break;
      }
      case 'reset_game': {
        if (!currentRoomId) {
          ws.send(JSON.stringify({ type: 'error', message: '你不在房间中' }));
          return;
        }
        handleReset(currentRoomId, ws);
        break;
      }
      default:
        ws.send(JSON.stringify({ type: 'error', message: '未知消息类型' }));
    }
  });

  ws.on('close', () => {
    // Don't immediately remove the player - allow reconnection
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const playerEntry = room.players.find(p => p.ws === ws);
        if (playerEntry) {
          playerEntry.disconnectedAt = Date.now();
          // Notify remaining player(s)
          broadcastToRoom(room, {
            type: 'opponent_disconnected',
            message: '对手已断开连接，等待重连...'
          }, ws);
        }
      }
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});