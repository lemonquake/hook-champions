import type { PartyKitServer, Party, Connection } from "partykit/server";

export default {
  onConnect(conn, room, ctx) {
    console.log(`Connection opened: ${conn.id} in room ${room.id}`);
  },

  onMessage(message, conn, room) {
    // Parse the incoming message
    // It should be stringified JSON: { type: 'playerPosition', id: '...', position: [...], hook: {...} }
    // We just broadcast it to everyone else
    room.broadcast(message as string, [conn.id]);
  },

  onClose(conn, room) {
    console.log(`Connection closed: ${conn.id}`);
    room.broadcast(JSON.stringify({ type: 'playerLeft', id: conn.id }));
  }
} satisfies PartyKitServer;
