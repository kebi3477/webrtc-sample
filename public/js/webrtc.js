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
}).then(stream => { // 허용 완료 될 경우 Promise Callback
    addVideoStream(myVideo, stream); // 내 비디오 추가
    setClientCount();

    myPeer.on('call', call => {
        if (call.metadata && call.metadata.type === 'screen-share') {
            call.answer();
            call.on('stream', screenShareStream => {
                console.log('stream access!', call);
                addShareScreen(screenShareStream);
            });
            call.on('close', () => {
                console.log('close');
                shareScreen.innerHTML = '';
            })

            screenPeers.push(call);
        } else {
            call.answer(stream); // Stream 응답을 전송
            const video = document.createElement('video');
            video.classList.add('yourVideo');
            video.id = call.peer;
            call.on('stream', userVideoStream => { // peerJs 스트림 응답할 경우
                // addVideoStream(video, userVideoStream);
            });
    
            peers.push(call);
        }
    });

    socket.on('user-connected', userId => { // 서버에서 user-connected 로 보낼 경우 응답
        connectToNewUser(userId, stream);
    });

    fetch(`/users`)
    .then(res => res.json())
    .then(data => {
        data.userIds.forEach(userId => {
            if (userId !== myId) {  // 자신의 ID는 제외하고 연결
                connectToNewUser(userId, stream);
            }
        });
    });
});

socket.on('user-disconnected', userId => { // 서버에서 user-disconnected 로 보낼 경우 응답
    removeVideo(userId); // 비디오 DOM 삭제
    peers.forEach(peer => {
        if (peer.peer === userId) {
            peer.close(); // call 연결 해제
        }
    })
    peers = peers.filter(peer => peer.peer !== userId);
});

socket.on('client-count', clientCount => {
    clientCountDOM.innerText = `현재 방 인원 : ${clientCount}`;
});

socket.on('user-stopped-screen-share', userId => {
    shareScreen.innerHTML = '';
    screenPeers.forEach(peer => {
        if (peer.peer === userId) {
            peer.close(); // call 연결 해제
        }
    })
    screenPeers = screenPeers.filter(peer => peer.peer !== userId);
})

myPeer.on('open', id => { // Peerjs 생성 됐을 경우
    myId = id;
    myVideo.id = id;
    socket.emit('join-room', ROOM_ID, id); // join-room 이라는 키로 ROOM_ID, id 전송
});

shareScreenBtn.addEventListener('click', () => { // 추가
    if (screenStream) {
        stopSharingScreen();
        return;
    }
    
    navigator.mediaDevices.getDisplayMedia({
        video: true
    }).then(stream => {
        screenStream = stream;
        addShareScreen(stream);
        
        stream.getTracks()[0].onended = () => { // 화면 공유가 종료될 때 이벤트
            stopSharingScreen();
        };

        // 기존 사용자들에게 화면 공유 스트림 전송
        peers.forEach(peer => {
            if (peer.peer !== myId) {
                const call = myPeer.call(peer.peer, stream, {
                    metadata: { type: 'screen-share' }
                });                
                // call.on('stream', userVideoStream => {
                //     console.log(peer);
                //     addShareScreen(userVideoStream);
                // });
                call.on('close', () => {
                    shareScreen.innerHTML = '';
                })
            }
        });
        socket.emit('start-screen-share', ROOM_ID, myId);
        console.log(peers);
    }).catch(error => {
        console.error('Failed to get display media', error);
    });
});

function stopSharingScreen() {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    shareScreen.innerHTML = '';
    socket.emit('stop-screen-share', ROOM_ID, myId);
}

function removeVideo(userId) {
    document.getElementById(userId)?.remove();
}

function connectToNewUser(userId, stream) {
    if (document.getElementById(userId)) {
        return;
    }   

    const call = myPeer.call(userId, stream, {
        metadata: { type: 'webcam' }
    }); // P2P 연결되어 있는 상대방에게 스트림 전송

    const video = document.createElement('video');
    video.classList.add('yourVideo')
    video.id = userId;

    call.on('stream', userVideoStream => { // stream 받았을 경우 실행
        addVideoStream(video, userVideoStream); // video 추가
    });
    call.on('close', () => {
        video.remove();
    });

    peers.push(call);
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
}

function addShareScreen(stream) {
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

async function setClientCount() {
    const count = await getClientCount()
    clientCountDOM.innerText = `현재 방 인원 : ${count}`;
}