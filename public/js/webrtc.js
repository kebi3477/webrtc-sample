const ROOM_ID = 'abcd'; // 룸 번호 abcd로 고정
const socket = io('/'); // 소켓 생성
const videoGrid = document.getElementById('video-grid'); // 비디오 추가할 wrap DOM
const clientCountDOM = document.getElementById('client-count');
const myPeer = new Peer(); // PeerJS 생성

const shareScreen = document.getElementById('share-screen');
const shareScreenBtn = document.getElementById('share-screen-btn');
const myVideo = document.createElement('video'); // 내 비디오 생성
myVideo.muted = true;
myVideo.classList.add('myVideo')

let peers = [];
let screenPeers = [];
let myId = '';
let screenStream;

navigator.mediaDevices.getUserMedia({ // 브라우저 내 사용자 카메라, 오디오 허용
    video: { facingMode: 'user' },
    audio: true
}).then(async stream => { // 허용 완료 될 경우 Promise Callback
    addVideoStream(myVideo, stream); // 내 비디오 추가
    setClientCount(await getClientCount());

    myPeer.on('call', call => {
        if (call.metadata && call.metadata.type === 'screen-share') {
            handleReceiveScreenShare(call);
        } else if (call.metadata && call.metadata.type === 'webcam') {
            handleReceiveWebcam(call, stream);
        }
    });

    socket.on('user-connected', userId => connectToNewUser(userId, stream));

    connectToUsers(await getUsers());
});

function handleReceiveScreenShare(call) {
    call.answer(); 

    call.on('stream', screenShareStream => addScreenShare(screenShareStream));
    call.on('close', () => disconnectScreenSharing())
    
    screenPeers.push(call);
}

function handleReceiveWebcam(call, stream) {
    call.answer(stream);

    const video = createDOM('video', call.peer, 'yourVideo');
    call.on('stream', userVideoStream => addVideoStream(video, userVideoStream, call.peer));

    peers.push(call);
}

socket.on('user-started-screen-share', userId => {
    if (userId !== myId) {
        stopScreenSharing();
    }
})

socket.on('user-disconnected', userId => { // 서버에서 user-disconnected 로 보낼 경우 응답
    removeVideo(userId); // 비디오 DOM 삭제
    peers = disconnectPeers(peers, userId);
});

socket.on('client-count', clientCount => {
    setClientCount(clientCount);
});

socket.on('user-stopped-screen-share', userId => {
    disconnectScreenSharing();
    screenPeers = disconnectPeers(screenPeers, userId);
})

myPeer.on('open', id => { // Peerjs 생성 됐을 경우
    myId = id;
    myVideo.id = id;
    socket.emit('join-room', ROOM_ID, id); // join-room 이라는 키로 ROOM_ID, id 전송
});

shareScreenBtn.addEventListener('click', () => { // 추가
    if (screenStream) {
        stopScreenSharing();
        return;
    }
    
    startScreenSharing();
});

function disconnectPeers(peers, id) {
    peers.forEach(peer => {
        if (peer.peer === id) {
            peer.close();
        }
    })

    return peers.filter(peer => peer.peer !== id);
}

function getMetaData(type) {
    return {
        metadata: { type }
    }
}

async function startScreenSharing() {
    try {
        const stream = await getDisplayMediaStream();
        handleScreenShare(stream);
        connectScreenSharing(stream);
        notifyServerOfScreenShare();
    } catch (error) {
        console.error('Error starting screen sharing:', error);
    }
}

async function getDisplayMediaStream() {
    return navigator.mediaDevices.getDisplayMedia({ video: true });
}

function handleScreenShare(stream) {
    screenStream = stream;
    addScreenShare(stream);

    const track = stream.getTracks()[0];
    track.onended = stopScreenSharing;
}

function notifyServerOfScreenShare() {
    socket.emit('start-screen-share', ROOM_ID, myId);
}

function connectScreenSharing(stream) {
    peers.forEach(peer => {
        if (peer.peer !== myId) {
            const call = myPeer.call(peer.peer, stream, getMetaData('screen-share'));
            call.on('close', () => { disconnectScreenSharing() })
        }
    });
}

function stopScreenSharing() {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    shareScreen.innerHTML = '';
    socket.emit('stop-screen-share', ROOM_ID, myId);
}

function disconnectScreenSharing() {
    shareScreen.innerHTML = '';
}

function removeVideo(userId) {
    document.getElementById(userId)?.remove();
}

function connectToNewUser(userId, stream) {
    if (document.getElementById(userId)) {
        return;
    }   

    const call = myPeer.call(userId, stream, getMetaData('webcam'));
    if (!call) {
        return;
    }

    const video = createDOM('video', userId, 'yourVideo');
    call.on('stream', userVideoStream => { // stream 받았을 경우 실행
        addVideoStream(video, userVideoStream, userId); // video 추가
    });
    call.on('close', () => video.remove());

    peers.push(call);
}

function createDOM(tag, id, ...classList) {
    const dom = document.createElement(tag);
    dom.id = id;
    classList.forEach(className => { dom.classList.add(className) })
    return dom;
}

function addVideoStream(video, stream, id=null) {
    if (id !== null && document.getElementById(id)) {
        return;
    }

    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

function addScreenShare(stream) {
    const video = document.getElementById('share-screen-video');
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
}

async function getClientCount() {
    try {
        const res = await fetch('/count');
    
        if (res.status === 200) {
            const data = await res.json();
            return data.clientCount;
        } else {
            return 0;
        }
    } catch (err) {
        alert(err);
        return 0;
    }
}

async function setClientCount(count) {
    clientCountDOM.innerText = `현재 방 인원 : ${count}`;
}

async function getUsers() {
    try {
        const res = await fetch(`/users`)

        if (res.status === 200) {
            const data = await res.json();
            return data.userIds;
        } else {
            return [];
        }
    } catch (err) {
        return [];
    }
}

async function connectToUsers(userIds, stream) {
    userIds.forEach(userId => {
        if (userId !== myId) {  // 자신의 ID는 제외하고 연결
            connectToNewUser(userId, stream);
        }
    })
}