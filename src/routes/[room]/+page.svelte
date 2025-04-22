<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as Y from 'yjs';
    import { WebsocketProvider } from 'y-websocket';
    import Editor from '$lib/Editor.svelte';
    
    // Get the room parameter from the page params
    let { room } = $props<{ room: string }>();
    
    // State for tracking mouse positions of all users and editor content
    let users = $state<Record<string, { x: number; y: number; color: string }>>({});
    let myId = $state<string>('');
    let connected = $state<boolean>(false);
    let editorContent = $state<any>(null);
    let lastEditorUpdate = $state<number>(0);
    let syncStatus = $state<'idle' | 'sending' | 'receiving'>('idle');
    let debugMessages = $state<string[]>([]);
    
    // Debug logging function that updates UI
    function debug(message: string) {
        console.log(`[Room ${room}]`, message);
        debugMessages = [...debugMessages.slice(-19), `${new Date().toISOString().substring(11, 19)} ${message}`];
    }
    
    // Generate a random color for this user
    const getRandomColor = () => {
        return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    };
    
    // Create a random user ID
    const userId = Math.floor(Math.random() * 10000).toString();
    const userColor = getRandomColor();
    
    // Y.js document and shared data
    let doc: Y.Doc;
    let provider: WebsocketProvider;
    let mousePositions: Y.Map<{ x: number; y: number; color: string }>;
    let blockContent: Y.Map<any>;
    
    // Handle editor content changes - immediately send to room
    function handleEditorContentChange(content: any) {
        if (!blockContent || !connected) return;
        
        // Don't process if this update has no data
        if (!content || !content.data) {
            debug('Received empty update');
            return;
        }
        
        // Get current time and origin info
        const timestamp = content.timestamp || Date.now();
        const origin = content.origin || '';
        
        debug(`Received editor update from ${origin}, sending to room immediately`);
        syncStatus = 'sending';
        
        // Immediately update the shared data
        blockContent.set('content', content.data);
        blockContent.set('timestamp', timestamp);
        blockContent.set('origin', origin);
        
        // Update local tracking state
        lastEditorUpdate = timestamp;
        
        // Reset sync status after a delay
        setTimeout(() => {
            syncStatus = 'idle';
        }, 500);
    }
    
    // Track mouse movement
    function handleMouseMove(event: MouseEvent) {
        if (!mousePositions || !connected) return;
        
        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        
        // Update our position in the shared Y.js data
        mousePositions.set(userId, { x, y, color: userColor });
    }
    
    // Handle leaving the collaborative space
    function handleMouseLeave() {
        if (mousePositions && connected) {
            mousePositions.delete(userId);
        }
    }
    
    // Initialize the room with Y.js
    function initRoom() {
        debug(`Initializing room: ${room}`);
        
        // Initialize Y.js document
        doc = new Y.Doc();
        
        // Connect to the WebSocket provider
        provider = new WebsocketProvider('wss://yjs.kruw.de:443', room, doc);
        
        // Get or create the shared mouse positions data
        mousePositions = doc.getMap('mouse-positions');
        
        // Get or create shared editor content
        blockContent = doc.getMap('block-content');
        
        // Set up observer for changes in mouse positions
        mousePositions.observe(() => {
            // Update users state with current mouse positions
            const currentUsers: Record<string, { x: number; y: number; color: string }> = {};
            
            mousePositions.forEach((position, id) => {
                currentUsers[id] = position;
            });
            
            users = currentUsers;
        });
        
        // Set up observer for changes in editor content - always update
        blockContent.observe(() => {
            const content = blockContent.get('content');
            if (content) {
                const timestamp = blockContent.get('timestamp') || 0;
                const origin = blockContent.get('origin') || '';
                
                debug(`Received Y.js update from ${origin}, timestamp: ${new Date(timestamp).toISOString().substring(11, 19)}`);
                
                // Accept all updates, even from ourselves
                syncStatus = 'receiving';
                debug('Applying received update to editor');
                
                editorContent = {
                    data: content,
                    timestamp: timestamp,
                    origin: origin
                };
                
                lastEditorUpdate = timestamp;
                
                // Reset sync status after a delay
                setTimeout(() => {
                    syncStatus = 'idle';
                }, 500);
            }
        });
        
        // Handle connection status
        provider.on('status', (event: { status: string }) => {
            const wasConnected = connected;
            connected = event.status === 'connected';
            
            debug(`Connection status: ${event.status}`);
            
            // When we first connect, request any existing content
            if (connected && !wasConnected) {
                const existingContent = blockContent.get('content');
                if (existingContent) {
                    debug('Retrieved existing content from room');
                    editorContent = {
                        data: existingContent,
                        timestamp: blockContent.get('timestamp') || Date.now(),
                        origin: blockContent.get('origin') || ''
                    };
                } else {
                    debug('No existing content in room');
                }
            }
        });
        
        // Set our ID for display purposes
        myId = userId;
    }
    
    // Clean up function for when component is destroyed
    function cleanup() {
        debug('Cleaning up room');
        
        if (mousePositions && connected) {
            mousePositions.delete(userId);
        }
        
        if (provider) {
            provider.disconnect();
            debug('Disconnected from Y.js provider');
        }
    }
    
    // Initialize on mount and clean up on destroy using traditional lifecycle methods
    onMount(() => {
        debug('Component mounted, initializing room');
        initRoom();
    });
    
    onDestroy(cleanup);
</script>

<div class="room-container">
    <h1>Room: {room}</h1>
    <div class="room-status">
        <div class="status-badge" class:connected={connected}>
            {connected ? 'Connected' : 'Connecting...'}
        </div>
        <div class="status-badge" class:active={syncStatus !== 'idle'} class:receiving={syncStatus === 'receiving'} class:sending={syncStatus === 'sending'}>
            {syncStatus === 'idle' ? 'Idle' : syncStatus === 'sending' ? 'Sending...' : 'Receiving...'}
        </div>
        <div class="user-id">Your ID: {myId}</div>
    </div>
    
    <div class="editor-container">
        <Editor initCode={editorContent} onContentChange={handleEditorContentChange} />
    </div>
    
    <div class="debug-panel">
        <h3>Room Debug Log</h3>
        <div class="debug-messages">
            {#each debugMessages as message}
                <div class="debug-message">{message}</div>
            {/each}
            {#if debugMessages.length === 0}
                <div class="debug-message">No room messages yet</div>
            {/if}
        </div>
    </div>
    
    <div 
        class="tracking-area" 
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
    >
        {#each Object.entries(users) as [id, { x, y, color }]}
            <div 
                class="cursor" 
                style="left: {x}px; top: {y}px; background-color: {color};"
            >
                <div class="cursor-id">{id === myId ? 'You' : id}</div>
            </div>
        {/each}
        
        <div class="instructions">
            <p>Move your mouse to see it tracked in real-time.</p>
            <p>Other users in this room will see your mouse movements.</p>
            <p>Share this URL with others to collaborate.</p>
        </div>
    </div>
    
    <div class="users-panel">
        <h3>Users in room ({Object.keys(users).length})</h3>
        <ul>
            {#each Object.entries(users) as [id, { color }]}
                <li>
                    <span class="user-dot" style="background-color: {color};"></span>
                    {id === myId ? `${id} (You)` : id}
                </li>
            {/each}
        </ul>
    </div>
</div>

<style>
    .room-container {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
    }
    
    .room-status {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
        align-items: center;
        flex-wrap: wrap;
    }
    
    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        background-color: #ddd;
        color: #333;
    }
    
    .status-badge.connected {
        background-color: #4CAF50;
        color: white;
    }
    
    .status-badge.active {
        animation: pulse 1s infinite;
    }
    
    .status-badge.receiving {
        background-color: #2196F3;
        color: white;
    }
    
    .status-badge.sending {
        background-color: #FF9800;
        color: white;
    }
    
    .user-id {
        font-weight: bold;
    }
    
    .queue-info {
        padding: 2px 6px;
        background-color: #eee;
        border-radius: 10px;
    }
    
    .editor-container {
        width: 100%;
        height: 400px;
        margin-bottom: 1rem;
        border: 2px solid #ccc;
        border-radius: 8px;
        overflow: hidden;
    }
    
    .debug-panel {
        width: 100%;
        height: 150px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-bottom: 1rem;
        overflow-y: auto;
        background-color: #f5f5f5;
    }
    
    .debug-panel h3 {
        margin: 5px;
        font-size: 14px;
        color: #333;
    }
    
    .debug-messages {
        padding: 5px;
        font-size: 12px;
        font-family: monospace;
    }
    
    .debug-message {
        margin-bottom: 2px;
        word-break: break-word;
    }
    
    .tracking-area {
        position: relative;
        width: 100%;
        height: 200px;
        border: 2px solid #ccc;
        border-radius: 8px;
        overflow: hidden;
        background-color: #f9f9f9;
        margin-bottom: 1rem;
    }
    
    .cursor {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        z-index: 10;
        pointer-events: none;
    }
    
    .cursor::before {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 10px solid currentColor;
        transform: translate(-2px, -10px) rotate(-45deg);
    }
    
    .cursor-id {
        position: absolute;
        top: 15px;
        left: 5px;
        background-color: inherit;
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 12px;
        white-space: nowrap;
    }
    
    .instructions {
        position: absolute;
        bottom: 20px;
        left: 0;
        right: 0;
        text-align: center;
        color: #666;
    }
    
    .users-panel {
        width: 100%;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background-color: #f5f5f5;
    }
    
    .users-panel h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
    }
    
    .users-panel ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .users-panel li {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
    
    .user-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 8px;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.6; }
        100% { opacity: 1; }
    }
</style>