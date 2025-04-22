<script lang="ts">
    import { useEventListener } from 'runed';
    import { untrack } from 'svelte';

    let { initCode = undefined, onContentChange = () => {} } = $props();

    let iframe: HTMLIFrameElement;
    let editorReady = $state(false);
    let codeLoaded = $state(false);
    let debugMessages = $state<string[]>([]);
    let showDebug = $state(true);
    let localUserId = $state(Math.random().toString(36).substring(2, 8));
    let lastRoomState = $state<any>(null);
    let debounceTimer = $state<number | undefined>(undefined);
    
    // Debug logging function that updates UI
    function debug(message: string) {
        console.log(`[Editor ${localUserId}]`, message);
        debugMessages = [...debugMessages.slice(-19), `${new Date().toISOString().substring(11, 19)} ${message}`];
    }
    
    // Function to load code into the iframe - always accepts updates
    function loadCode(code: any) {
        if (!editorReady || !iframe?.contentWindow) return;
        
        try {
            debug('Loading code into iframe');
            const serializableCode = JSON.parse(JSON.stringify(code));
            
            iframe.contentWindow.postMessage(
                {
                    type: 'blocks.updateProject',
                    data: serializableCode
                }, '*');
            
            codeLoaded = true;
            debug('Code loaded successfully');
        } catch (error) {
            debug(`Error loading code: ${error}`);
        }
    }
    
    // Manual room state loading function
    function loadRoomState() {
        if (lastRoomState) {
            debug('Manually loading room state');
            loadCode(lastRoomState);
        } else if (initCode) {
            debug('No recent room state, loading initial code');
            loadCode(initCode.data || initCode);
        } else {
            debug('No code available to load');
        }
    }
    
    // Handle messages from the iframe
    function handleMessage(event: MessageEvent) {
        const data = event.data;
        
        switch (data.type) {
            case 'blocks.ready':
                debug('Editor is ready to receive code');
                editorReady = true;
                
                // Load initial code when editor is ready
                if (initCode !== undefined && !codeLoaded) {
                    loadCode(initCode);
                }
                break;

            case 'blocks.updateProject':
                if (editorReady && data.data) {
                    if(data.event.element == "selected" || !data.event.recordUndo) {
                        console.log('drop event:', data.event);
                        return;
                    } else if (JSON.stringify(JSON.parse(data.data)) == JSON.stringify(lastRoomState)) {
                        console.log('Room state unchanged:', data.data);
                    }
                    console.log('Sending updated content to room', data.data, JSON.stringify(lastRoomState), data);
                    
                    // Use untrack to prevent reactivity loops
                    untrack(() => {
                        onContentChange({
                            data: JSON.parse(data.data),
                            origin: localUserId,
                            timestamp: Date.now()
                        });
                    });
                }
                break;
                
            default:
                // Debug other messages
                if (data.type && data.type !== 'ping') {
                    debug(`Received ${data.type} message`);
                }
                break;
        }
    }

    // Function to debounce operations
    function debounce(fn: Function, delay: number) {
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            fn();
            debounceTimer = undefined;
        }, delay) as unknown as number;
    }
    
    // Store room state but don't auto-load it with debounce
    $effect(() => {
        if (!initCode || initCode.origin == localUserId) return;
        
        debounce(() => {
            if (JSON.stringify(initCode.data) !== JSON.stringify(lastRoomState)) {
                debug('Room state updated with debounce, storing and loading', initCode.data, lastRoomState);
                loadCode(initCode.data);
                lastRoomState = initCode.data;
            }
        }, 10); // 100ms debounce time
    });

    // Toggle debug panel visibility
    function toggleDebug() {
        showDebug = !showDebug;
    }
    
    useEventListener(
        () => window,
        'message',
        handleMessage
    );
</script>

<div class="editor-container">
    <div class="Blocks-editor">
        <iframe
            bind:this={iframe}
            title="Calliope Blocks Editor"
            src="https://iframe-test4.scratch-calliope.pages.dev"
            frameborder="0"
            width="100%"
            height="100%"
        ></iframe>
    </div>
    
    <div class="controls">
        <button 
            class="sync-button" 
            onclick={loadRoomState}
        >
            Load Room State
        </button>
        
        <button 
            class="debug-toggle" 
            onclick={toggleDebug}
        >
            {showDebug ? 'Hide' : 'Show'} Debug
        </button>
        
        <span class="status-indicator" class:ready={editorReady}></span>
        <span class="status-text">
            {#if !editorReady}
                Editor loading...
            {:else}
                Ready (ID: {localUserId.substring(0, 4)})
            {/if}
        </span>
    </div>
    
    {#if showDebug}
        <div class="debug-panel">
            <h3>Debug Log</h3>
            <div class="debug-messages">
                {#each debugMessages as message}
                    <div class="debug-message">{message}</div>
                {/each}
                {#if debugMessages.length === 0}
                    <div class="debug-message">No messages yet</div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .editor-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
    }
    
    .Blocks-editor {
        flex: 1;
        position: relative;
    }

    iframe {
        border: none;
        width: 100%;
        height: 100%;
    }
    
    .controls {
        position: absolute;
        top: 5px;
        right: 5px;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.8);
        padding: 5px;
        border-radius: 4px;
    }
    
    .sync-button {
        background-color: #4a90e2;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s;
    }
    
    .sync-button:hover {
        background-color: #3a80d2;
    }
    
    .sync-button.has-changes {
        background-color: #e25b4a;
        animation: pulse 1.5s infinite;
    }
    
    .debug-toggle {
        background-color: #666;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
    }
    
    .status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #666;
    }
    
    .status-indicator.ready {
        background-color: #0a0;
    }
    
    .status-text {
        font-size: 12px;
        white-space: nowrap;
    }
    
    .debug-panel {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.8);
        color: #0f0;
        font-family: monospace;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
    }
    
    .debug-panel h3 {
        margin: 5px;
        font-size: 14px;
    }
    
    .debug-messages {
        padding: 5px;
        font-size: 12px;
    }
    
    .debug-message {
        margin-bottom: 2px;
        word-break: break-word;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.8; }
        100% { opacity: 1; }
    }
</style>
