const WS_URL = `ws://${window.location.hostname}:3001`;

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit(msg.type, msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected');
      // Auto reconnect after 3 seconds
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    if (callbacks.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, callbacks);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const callback of this.listeners.get(event)) {
      callback(data);
    }
  }
}

const wsService = new WebSocketService();
export default wsService;