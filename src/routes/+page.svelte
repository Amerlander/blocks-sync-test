<script lang="ts">
	import { goto } from '$app/navigation';
	
	let roomId = $state('');
	
	// Generate a random room ID
	function createRoom() {
		const randomRoomId = Math.random().toString(36).substring(2, 8);
		goto(`/${randomRoomId}`);
	}
	
	// Join an existing room
	function joinRoom() {
		if (roomId.trim()) {
			goto(`/${roomId}`);
		}
	}
</script>

<div class="container">
	<h1>Real-time Mouse Tracking with Svelte 5 and Yjs</h1>
	
	<div class="actions">
		<button onclick={createRoom} class="primary">Create a New Room</button>
		
		<div class="join-form">
			<input 
				type="text" 
				placeholder="Enter room ID" 
				bind:value={roomId}
				onkeypress={(e) => e.key === 'Enter' && joinRoom()}
			/>
			<button onclick={joinRoom}>Join Room</button>
		</div>
	</div>
	
	<div class="info">
		<h2>How it works</h2>
		<p>
			This application uses Svelte 5 and Yjs to create a collaborative space where users can see 
			each other's mouse movements in real-time.
		</p>
		<ul>
			<li>Create a room or join an existing one using a room ID</li>
			<li>Share the URL with others to collaborate</li>
			<li>Move your mouse in the tracking area to see it reflected in real-time</li>
			<li>Others in the same room will see your mouse movements</li>
		</ul>
		<p>
			All communication happens through a secure WebSocket connection.
		</p>
	</div>
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}
	
	h1 {
		font-size: 2rem;
		margin-bottom: 2rem;
	}
	
	.actions {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 3rem;
	}
	
	button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		background-color: #e9e9e9;
		cursor: pointer;
		font-size: 1rem;
		transition: background-color 0.2s;
	}
	
	button:hover {
		background-color: #d9d9d9;
	}
	
	button.primary {
		background-color: #4169e1;
		color: white;
		font-weight: bold;
		padding: 1rem 2rem;
	}
	
	button.primary:hover {
		background-color: #3258ce;
	}
	
	.join-form {
		display: flex;
		gap: 0.5rem;
	}
	
	input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}
	
	.info {
		background-color: #f5f5f5;
		padding: 1.5rem;
		border-radius: 8px;
	}
	
	h2 {
		margin-top: 0;
	}
	
	ul {
		line-height: 1.6;
	}
</style>
