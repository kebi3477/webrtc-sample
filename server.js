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
let clientCount;
let userIds = [];

app.use('/public', express.static(__dirname + '/public')); // public 폴더 안 모든 파일은 접근 가능하게 설정

io.on('connection', (socket) => { // 소켓 연결 될 경우
    socket.on('join-room', (roomId, userId) => { // join-room 이라는 키로 소켓 수신
        console.log(`새로운 사용자 접속! room : ${roomId} , userId : ${userId}`); 
        socket.join(roomId); // 소켓 roomId로 방 접속
        socket.broadcast.to(roomId).emit('user-connected', userId); //user-connected 라는 키로 userId 전송
        userIds.push(userId);

        socket.on('disconnect', () => { // 소켓 연결 해제 될 경우
            console.log(`사용자 접속 해제! room : ${roomId} , userId : ${userId}`); 
            socket.broadcast.to(roomId).emit('user-disconnected', userId); // user-disconnected 라는 키로 userId 전송
            sendClientSize(socket, roomId);
            userIds = userIds.filter(data => data !== userId);
        });

        sendClientSize(socket, roomId);
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

function sendClientSize(socket, roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room) {
        clientCount = room.size;
        socket.broadcast.to(roomId).emit('client-count', room.size);
    }
}

function getServer() {
    const isHTTPS = process.env.HTTPS === 'true';

    if (isHTTPS) {
        const privateKey  = fs.readFileSync(process.env.HTTPS_KEY, 'utf8');
        const certificate = fs.readFileSync(process.env.HTTPS_CERT, 'utf8');
        const ca = fs.readFileSync(process.env.HTTPS_CA, 'utf8');  // 인증서 체인 (필요한 경우)
        const credentials = {
            key: privateKey,
            cert: certificate,
            ca: ca
        };
        return https.createServer(credentials, app);
    } else {
        return http.createServer(app); // HTTP 서버를 생성
    }
}