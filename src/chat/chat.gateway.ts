import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface ChatMessage {
  id: string;
  message: string;
  sender: string;
  senderId: string;
  timestamp: Date;
  roomId: string;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://code-collab-frontend-gamma.vercel.app'],
    credentials: true,
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  private chatRooms: Map<string, ChatMessage[]> = new Map();

  handleConnection(client: Socket) {
    console.log(`Chat client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-chat')
  handleJoinChat(client: Socket, roomId: string) {
    client.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!this.chatRooms.has(roomId)) {
      this.chatRooms.set(roomId, []);
    }
    
    // Send chat history to the joining client
    const roomHistory = this.chatRooms.get(roomId) || [];
    client.emit('chat-history', roomHistory);
    
    console.log(`Client ${client.id} joined chat room: ${roomId}`);
  }

  @SubscribeMessage('send-message')
  handleSendMessage(client: Socket, messageData: ChatMessage) {
    const { roomId } = messageData;
    
    // Add message to room history
    if (this.chatRooms.has(roomId)) {
      const roomMessages = this.chatRooms.get(roomId)!;
      roomMessages.push(messageData);
      
      // Keep only last 100 messages to prevent memory issues
      if (roomMessages.length > 100) {
        roomMessages.shift();
      }
    }
    
    // Broadcast to all clients in the room including sender
    this.server.to(roomId).emit('chat-message', messageData);
  }

  @SubscribeMessage('leave-chat')
  handleLeaveChat(client: Socket, roomId: string) {
    client.leave(roomId);
    console.log(`Client ${client.id} left chat room: ${roomId}`);
  }
}