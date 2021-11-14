const webSocketsServerPort = process.env.PORT || 8000 ;
const webSocketServer = require('websocket').server;
const http = require('http');
// Spinning the http server and the websocket server.
const server = http.createServer();

server.listen(webSocketsServerPort);
const wsServer = new webSocketServer({
  httpServer: server,
});

let rooms = {};

wsServer.on('request', (request) => {
  const connection = request.accept(null, request.origin);

  connection.on('message', (__) => {
    // if (__.type != 'utf8') return;
    const { type, data } = JSON.parse(__.utf8Data);
    switch (type) {
      case 'create_room': {
        const room_id = Math.random()
          .toString(36)
          .replace(/[^a-z]+/g, '')
          .substr(2, 10);

        rooms[room_id] = {
          ...data,
          admin_connection: connection,
          users_which_awaiting: {},
          activated_fields: [],
        };

        return connection.sendUTF(JSON.stringify({ room_id, type: 'room_id' }));
      }

      case 'asking_for_acsess': {
        let { user_id, connect_room_id } = data;
        const current_room = rooms[connect_room_id];
        user_id = user_id + Date.now();
        current_room.users_which_awaiting = { ...current_room?.users_which_awaiting, [user_id]: connection };

        rooms[connect_room_id]?.admin_connection?.sendUTF(JSON.stringify({ user_id, type: 'asking_for_acsess' }));

        return;
      }

      case 'open_field': {
        const { index, room_id } = data;
        let current_room = rooms[room_id];
        let activated_fields = current_room?.activated_fields;
        activated_fields.push(index);
        current_room?.admin_connection?.sendUTF(
          JSON.stringify({ type: 'updated_of_activated_fields', activated_fields })
        );
        return;
      }

      case 'resolve_acsess':
      case 'reject_acsess': {
        const { user_id, room_id } = data;
        const current_room = rooms[room_id];
        const user_connection = current_room?.users_which_awaiting?.[user_id];

        const is_resolved = type === 'resolve_acsess';
        const ground = is_resolved ? current_room.ground : {};
        const teams = is_resolved ? current_room.teams : {};

        user_connection?.sendUTF(JSON.stringify({ type, ground, teams,user_id }));

        if (!is_resolved) {
          delete user_connection;
        }
        return;
      }

      default:
        break;
    }
  });
});
