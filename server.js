// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Queue for public game matchmaking
const publicQueue = [];

// Map to store private games by their 3-digit code
const privateGames = {};

io.on('connection', (socket) => {
  console.log('User connected: ' + socket.id);

  // Handle public game joining
  socket.on('joinPublic', () => {
    if (publicQueue.length > 0) {
      const opponent = publicQueue.shift();
      const room = 'room-' + opponent.id + '-' + socket.id;
      socket.join(room);
      opponent.join(room);
      // Assign colors: opponent (first) is white, current socket is black.
      io.to(room).emit('startGame', { room: room, white: opponent.id, black: socket.id });
      console.log('Public game started in room ' + room);
    } else {
      publicQueue.push(socket);
      socket.emit('waiting', 'Waiting for an opponent to join...');
    }
  });

  // Handle creating a private game
  socket.on('createPrivate', () => {
    let code;
    do {
      code = Math.floor(100 + Math.random() * 900).toString();
    } while (privateGames[code]);
    privateGames[code] = { host: socket, room: 'private-' + code };
    socket.join(privateGames[code].room);
    socket.emit('privateCreated', { code });
    console.log('Private game created with code ' + code);
  });

  // Handle joining a private game using a code
  socket.on('joinPrivate', (code) => {
    if (privateGames[code]) {
      const game = privateGames[code];
      const room = game.room;
      socket.join(room);
      // For private games, host is white, joiner is black.
      io.to(room).emit('startGame', { room: room, white: game.host.id, black: socket.id });
      delete privateGames[code];
      console.log('Private game joined with code ' + code);
    } else {
      socket.emit('errorMessage', 'Invalid game code');
    }
  });

  // Handle move events
  socket.on('move', (data) => {
    console.log("Received move:", data);
    // Broadcast move to the other player in the room
    socket.to(data.room).emit('move', data);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.id);
    // Remove the socket from the public queue if still waiting
    const index = publicQueue.indexOf(socket);
    if (index !== -1) {
      publicQueue.splice(index, 1);
    }
    // Clean up any private games created by this socket
    for (const code in privateGames) {
      if (privateGames[code].host.id === socket.id) {
        delete privateGames[code];
      }
    }
  });
});

server.listen(3000, () => {
  console.log('xchess server is listening on *:3000');
});
