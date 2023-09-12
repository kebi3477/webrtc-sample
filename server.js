require('dotenv').config();

const express = require('express'); // express
const http = require('http'); // HTTP 프로토콜 연결
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io'); // 웹소켓

const app = express(); // express를 생성
const server = getServer();
const io = socketIo(server); // 소켓 생성
const port = process.env.PORT ?? 3000;

let clientCount = 0;
let userIds = [];

app.use('/public', express.static(__dirname + '/public')); // public 폴더 안 모든 파일은 접근 가능하게 설정

io.on('connection', (socket) => { // 소켓 연결 될 경우
    socket.on('join-room', (roomId, userId) => {
        handleJoinRoom(socket, roomId, userId);
    });

    socket.on('start-screen-share', (roomId, userId) => {
        socket.broadcast.to(roomId).emit('user-started-screen-share', userId);
    });

    socket.on('stop-screen-share', (roomId, userId) => {
        socket.broadcast.to(roomId).emit('user-stopped-screen-share', userId);
    });
});

app.get('/', (req, res) => { // root 라우팅 설정
    res.sendFile(__dirname + '/public/index.html'); 
});

app.get('/count', (req, res) => {
    res.send({ clientCount });
})

app.get('/users', (req, res) => {
    res.send({ userIds })
})

server.listen(port, () => { // 3000번 포트로 서버 열기
    console.log(`Server is running on port ${port}`);
});


function handleJoinRoom(socket, roomId, userId) {
    console.log(`새로운 사용자 접속! room : ${roomId} , userId : ${userId}`);

    socket.join(roomId);
    socket.on('disconnect', () => { handleUserDisconnect(socket, roomId, userId) });

    userIds.push(userId);
    sendClientSize(socket, roomId);
    socket.broadcast.to(roomId).emit('user-connected', userId); //user-connected 라는 키로 userId 전송
}

function handleUserDisconnect(socket, roomId, userId) {
    console.log(`사용자 접속 해제! room : ${roomId} , userId : ${userId}`);

    userIds = userIds.filter(data => data !== userId);
    sendClientSize(socket, roomId);
    socket.broadcast.to(roomId).emit('user-disconnected', userId); //user-connected 라는 키로 userId 전송
}

function getClientCount(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
}

function sendClientSize(socket, roomId) {
    clientCount = getClientCount(roomId);
    socket.broadcast.to(roomId).emit('client-count', clientCount);
}

function getCredentials() {
    return { 
        key  : fs.readFileSync(process.env.HTTPS_KEY, 'utf8'), 
        cert : fs.readFileSync(process.env.HTTPS_CERT, 'utf8'), 
        ca   : fs.readFileSync(process.env.HTTPS_CA, 'utf8')
    }
}

function getServer() {
    return process.env.HTTPS === 'true' ?  https.createServer(getCredentials(), app) : http.createServer(app);
}