import { followUser } from './twitterApiFollow';
import 'dotenv/config';

async function testFollowUser() {
    try {
        // Replace with a real Twitter user ID you want to test following
        // You can find user IDs by looking at Twitter URLs or using online tools
        const testUserId = '44196397'; // This was the user ID from your earlier test

        console.log(`Attempting to follow user ID: ${testUserId}`);

        const result = await followUser(testUserId);

        console.log('Follow successful!');
        console.log('Response:', JSON.stringify(result, null, 2));

    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null) {
            // @ts-ignore
            console.error('Follow failed:', (error as any).message || error);
            // @ts-ignore
            if ('response' in error && error.response) {
                // @ts-ignore
                console.error('Status:', error.response.status);
                // @ts-ignore
                console.error('Response:', error.response.data);
            }
        } else {
            console.error('Follow failed:', error);
        }
    }
}

testFollowUser();