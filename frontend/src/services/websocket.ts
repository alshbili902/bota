type MessageCallback = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private reconnectTimer: any = null;
  private pingInterval: any = null;

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = localStorage.getItem('rahami_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/ws/progress?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Start ping heartbeat
        this.pingInterval = setInterval(() => {
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send('ping');
          }
        }, 20000);
      };

      this.socket.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const data = JSON.parse(event.data);
          this.listeners.forEach((callback) => callback(data));
        } catch {
          // ignore non-json messages
        }
      };

      this.socket.onclose = () => {
        this.cleanup();
        // Attempt reconnect after 3 seconds if token still exists
        if (localStorage.getItem('rahami_token')) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.socket.onerror = () => {
        this.socket?.close();
      };
    } catch {
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }

  subscribe(callback: MessageCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  disconnect() {
    this.cleanup();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private cleanup() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
}

export const wsService = new WebSocketService();
