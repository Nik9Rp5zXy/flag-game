/**
 * R&D Chaos Bot Simulator
 * Usage: node bot-stress-test.js
 */
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000'; // Target environment

// To simulate REST authentication quickly without axios, we can directly hit the server or skip auth if it's not strictly required in socket.
// Wait, the backend requires a JWT token for 'authenticate' event.
// Let's use native fetch since Node 18+ has it.

async function spawnBot(username, password) {
    console.log(`[BOT] Spawning ${username}...`);
    // 1. Authenticate
    let token = '';
    try {
        const res = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok && data.token) {
            token = data.token;
        } else {
            // Auto-register
            const reg = await fetch(`${SERVER_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const regData = await reg.json();
            token = regData.token;
        }
    } catch (e) {
        console.error('Failed to authenticate:', e.message);
        return null;
    }

    if (!token) {
        console.error(`[BOT] Token failed for ${username}`);
        return null;
    }

    // 2. Connect Socket
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socket.emit('authenticate', token);
    
    return { socket, token, username };
}

async function runSimulation() {
    console.log('--- STARTING R&D STRESS TEST ---');
    const botA = await spawnBot('ChaosBot_A', '123456');
    const botB = await spawnBot('ChaosBot_B', '123456');

    if (!botA || !botB) return console.error('Failed to spawn bots.');

    // SCENARIO 1: Matchmaking
    console.log('[TEST] Initiating Matchmaking...');
    setTimeout(() => {
        botA.socket.emit('find_match', { gameMode: 'flag', token: botA.token });
        botB.socket.emit('find_match', { gameMode: 'flag', token: botB.token });
    }, 1000);

    let roomId = null;
    let questionsReceived = 0;

    botA.socket.on('match_found', (data) => {
        roomId = data.roomId;
        console.log(`[TEST] Match Found! Room: ${roomId}`);
    });

    botA.socket.on('new_question', (question) => {
        questionsReceived++;
        // SCENARIO 2: Chaos & Rate Limit Bypassing
        console.log(`[TEST] Question #${questionsReceived} received. Injecting malicious payloads...`);
        
        // Malicious Payload 1: Out of sync Timestamp ID
        botA.socket.emit('submit_answer', { 
            roomId, 
            answerId: 'wrong_id', 
            questionId: Date.now() - 10000 // Spoofed old timestamp
        });

        // Malicious Payload 2: Rate Limit Spam (50 requests in 10ms)
        console.log('[TEST] Firing 50 rapid socket payloads (Rate Limit Spam)...');
        for(let i=0; i<50; i++) {
            botA.socket.emit('submit_answer', { 
                roomId, 
                answerId: question.options[0].id, 
                questionId: question.createdAt 
            });
        }
    });
    
    botA.socket.on('chat_error', (data) => {
       console.log(`[SERVER WARNING A] ${data.message}`);
    });
    
    botA.socket.on('update_hp', (data) => {
        console.log(`[STATE A] HP Update -> P1: ${data.p1Hp}, P2: ${data.p2Hp}`);
    });

    // SCENARIO 3: Reconnect Test
    setTimeout(() => {
        if (!roomId) return;
        console.log('[TEST] Dropping Bot B connection abruptly...');
        botB.socket.disconnect();

        setTimeout(() => {
            console.log('[TEST] Reconnecting Bot B & Reclaiming Session...');
            const newSocket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
            newSocket.emit('authenticate', botB.token);
            
            // Wait 1 second for auth, then reclaim
            setTimeout(() => {
                newSocket.emit('reclaim_session', { token: botB.token, roomId });
            }, 1000);

        }, 5000); // Wait 5 seconds before returning
    }, 10000);
    
    // Stop simulation after 25s
    setTimeout(() => {
        console.log('--- R&D TEST COMPLETE ---');
        process.exit(0);
    }, 25000);
}

runSimulation();
