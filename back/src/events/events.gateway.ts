import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinVault')
  handleJoinVault(
    @MessageBody() vaultId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`vault_${vaultId}`);
    this.logger.log(`Client ${client.id} joined vault_${vaultId}`);
    return { event: 'joinedVault', data: vaultId };
  }

  @SubscribeMessage('leaveVault')
  handleLeaveVault(
    @MessageBody() vaultId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`vault_${vaultId}`);
    this.logger.log(`Client ${client.id} left vault_${vaultId}`);
    return { event: 'leftVault', data: vaultId };
  }

  // Used for real-time collaboration signals (e.g., cursor position, selection)
  @SubscribeMessage('collaborationSignal')
  handleCollaborationSignal(
    @MessageBody() data: { vaultId: string; payload: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`vault_${data.vaultId}`).emit('collaborationSignal', {
      clientId: client.id,
      ...data.payload,
    });
  }

  // Method to be called by services to broadcast updates
  broadcastToVault(vaultId: string, event: string, payload: any) {
    this.server.to(`vault_${vaultId}`).emit(event, payload);
  }
}
