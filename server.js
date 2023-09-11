const express = require('express'); // express
const http = require('http'); // HTTP 프로토콜 연결
const socketIo = require('socket.io'); // 웹소켓

const app = express(); // express를 생성
const server = http.createServer(app); // HTTP 서버를 생성
const io = socketIo(server); // 소켓 생성
let clientCount;

app.use('/public', express.static(__dirname + '/public')); // public 폴더 안 모든 파일은 접근 가능하게 설정

io.on('connection', (socket) => { // 소켓 연결 될 경우
    socket.on('join-room', (roomId, userId) => { // join-room 이라는 키로 소켓 수신
        console.log(`새로운 사용자 접속! room : ${roomId} , userId : ${userId}`); 
        socket.join(roomId); // 소켓 roomId로 방 접속
        socket.broadcast.to(roomId).emit('user-connected', userId); //user-connected 라는 키로 userId 전송

        socket.on('disconnect', () => { // 소켓 연결 해제 될 경우
            console.log(`사용자 접속 해제! room : ${roomId} , userId : ${userId}`); 
            socket.broadcast.to(roomId).emit('user-disconnected', userId); // user-disconnected 라는 키로 userId 전송
            sendClientSize(socket, roomId);
        });

        sendClientSize(socket, roomId);
    });
});

app.get('/', (req, res) => { // root 라우팅 설정
    res.sendFile(__dirname + '/public/index.html'); 
});

app.get('/count', (req, res) => {
    res.send({ clientCount });
})

server.listen(3000, () => { // 3000번 포트로 서버 열기
    console.log('Server is running on port 3000');
});

function sendClientSize(socket, roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room) {
        clientCount = room.size;
        socket.broadcast.to(roomId).emit('client-count', room.size);
    }
}