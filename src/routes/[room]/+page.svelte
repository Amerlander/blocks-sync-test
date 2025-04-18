<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Y from 'yjs';
	import { WebsocketProvider } from 'y-websocket';
	
	// Get the room parameter from the page params
	let { room } = $props<{ room: string }>();
	
	// State for tracking mouse positions of all users
	let users = $state<Record<string, { x: number; y: number; color: string }>>({});
	let myId = $state<string>('');
	let connected = $state<boolean>(false);
	
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
	
	onMount(() => {
		// Initialize Y.js document
		doc = new Y.Doc();
		
		// Connect to the WebSocket provider
		provider = new WebsocketProvider('wss://yjs.kruw.de:443', room, doc);
		
		// Get or create the shared mouse positions data
		mousePositions = doc.getMap('mouse-positions');
		
		// Set up observer for changes in mouse positions
		mousePositions.observe(event => {
			// Update users state with current mouse positions
			const currentUsers: Record<string, { x: number; y: number; color: string }> = {};
			
			mousePositions.forEach((position, id) => {
				currentUsers[id] = position;
			});
			
			users = currentUsers;
		});
		
		// Handle connection status
		provider.on('status', (event: { status: string }) => {
			connected = event.status === 'connected';
		});
		
		// Set our ID for display purposes
		myId = userId;
	});
	
	onDestroy(() => {
		// Clean up when component is destroyed
		if (mousePositions && connected) {
			mousePositions.delete(userId);
		}
		
		if (provider) {
			provider.disconnect();
		}
	});
</script>

<div class="room-container">
	<h1>Room: {room}</h1>
	<p>Your ID: {myId} {connected ? '(connected)' : '(connecting...)'}</p>
	
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
</div>

<style>
	.room-container {
		width: 100%;
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
	}
	
	.tracking-area {
		position: relative;
		width: 100%;
		height: 500px;
		border: 2px solid #ccc;
		border-radius: 8px;
		overflow: hidden;
		background-color: #f9f9f9;
		margin-top: 2rem;
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
</style>