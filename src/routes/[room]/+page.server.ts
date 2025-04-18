import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ params }) => {
	// Extract the room parameter from the URL
	return {
		room: params.room
	};
};