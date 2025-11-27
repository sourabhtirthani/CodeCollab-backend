import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface User {
    id: string;
    name: string;
    socketId: string;
}

interface Room {
    id: string;
    users: User[];
    code: string;
    language: string;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://code-collab-frontend-gamma.vercel.app',
      'https://code-collab-frontend.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }
})
export class CodeEditorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    private rooms: Map<string, Room> = new Map();

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
        this.removeUserFromAllRooms(client.id);
    }

    @SubscribeMessage('join-room')
    handleJoinRoom(client: Socket, payload: { roomId: string; userName: string }) {
        const { roomId, userName } = payload;

        // Create room if it doesn't exist
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                users: [],
                code: '// Start coding...\nconsole.log("Hello World!");',
                language: 'javascript'
            });
        }

        const room = this.rooms.get(roomId)!;

        // Add user to room
        const user: User = {
            id: client.id,
            name: userName,
            socketId: client.id
        };

        room.users.push(user);
        client.join(roomId);

        // Send current room state to the new user
        client.emit('room-state', {
            code: room.code,
            language: room.language,
            users: room.users
        });

        // Notify other users in the room
        client.to(roomId).emit('user-joined', user);

        console.log(`User ${userName} joined room ${roomId}`);
    }

    @SubscribeMessage('code-change')
    handleCodeChange(client: Socket, payload: { roomId: string; code: string }) {
        const { roomId, code } = payload;

        if (this.rooms.has(roomId)) {
            const room = this.rooms.get(roomId)!;
            room.code = code;

            // Broadcast to all other users in the room
            client.to(roomId).emit('code-update', code);
        }
    }

    @SubscribeMessage('language-change')
    handleLanguageChange(client: Socket, payload: { roomId: string; language: string }) {
        const { roomId, language } = payload;

        if (this.rooms.has(roomId)) {
            const room = this.rooms.get(roomId)!;
            room.language = language;

            // Broadcast to all other users in the room
            client.to(roomId).emit('language-update', language);
        }
    }

    @SubscribeMessage('leave-room')
    handleLeaveRoom(client: Socket, roomId: string) {
        this.removeUserFromRoom(client.id, roomId);
        client.leave(roomId);
    }

    @SubscribeMessage('typing-start')
    handleTypingStart(client: Socket, payload: { roomId: string; userName: string }) {
        const { roomId, userName } = payload;

        // Broadcast to other users that someone started typing
        client.to(roomId).emit('user-typing', {
            userName,
            isTyping: true
        });
    }

    @SubscribeMessage('typing-stop')
    handleTypingStop(client: Socket, payload: { roomId: string; userName: string }) {
        const { roomId, userName } = payload;

        // Broadcast to other users that someone stopped typing
        client.to(roomId).emit('user-typing', {
            userName,
            isTyping: false
        });
    }

    @SubscribeMessage('code-execution')
    handleCodeExecution(client: Socket, payload: { roomId: string; output: string }) {
        const { roomId, output } = payload;

        // Broadcast output to all users in the room including sender
        this.server.to(roomId).emit('output-update', output);
    }
    @SubscribeMessage('cursor-position')
    handleCursorPosition(client: Socket, payload: {
        roomId: string;
        userName: string;
        position: { line: number; ch: number };
        from: { line: number; ch: number } | null;
    }) {
        const { roomId, userName, position, from } = payload;

        // Broadcast cursor position to other users
        client.to(roomId).emit('user-cursor-move', {
            userName,
            position,
            from,
            socketId: client.id
        });
    }
    private removeUserFromRoom(socketId: string, roomId: string) {
        if (this.rooms.has(roomId)) {
            const room = this.rooms.get(roomId)!;
            const userIndex = room.users.findIndex(user => user.socketId === socketId);

            if (userIndex > -1) {
                const user = room.users[userIndex];
                room.users.splice(userIndex, 1);

                // Notify other users
                this.server.to(roomId).emit('user-left', user);

                // Remove room if empty
                if (room.users.length === 0) {
                    this.rooms.delete(roomId);
                }
            }
        }
    }

    private removeUserFromAllRooms(socketId: string) {
        this.rooms.forEach((room, roomId) => {
            this.removeUserFromRoom(socketId, roomId);
        });
    }
}