#!/usr/bin/env node
/**
 * Demo script showing Twitter account rotation in action
 * 
 * This simulates the 5-minute rotation behavior by:
 * 1. Getting the earliest used account
 * 2. Using it for a "fetch operation" (simulated)
 * 3. Marking it as used
 * 4. Repeating to show rotation
 */

import { twitterAccountManager } from '../services/twitterAccountManager';
import 'dotenv/config';

async function simulateTwitterFetch() {
    console.log('🐦 Twitter Account Rotation Demo');
    console.log('================================\n');

    try {
        // Show initial state
        console.log('📊 Initial account usage state:');
        const initialAccounts = await twitterAccountManager.getAllAccountsUsage();
        initialAccounts.forEach((account, index) => {
            console.log(`   ${index + 1}. ${account.accountId.slice(0, 20)}...`);
            console.log(`      Last used: ${account.lastUsed || 'Never'}`);
            console.log(`      Total requests: ${account.totalRequests || 0}`);
        });

        console.log('\n🔄 Simulating 5-minute rotation cycles...\n');

        // Simulate 5 fetch cycles (representing 5-minute intervals)
        for (let cycle = 1; cycle <= 5; cycle++) {
            console.log(`--- Cycle ${cycle} (${cycle * 5} minutes) ---`);

            // Get the account that should be used (earliest used)
            const selectedAccount = await twitterAccountManager.getEarliestUsedAccount();

            console.log(`🎯 Selected: ${selectedAccount.accountId.slice(0, 20)}...`);
            console.log(`   Last used: ${selectedAccount.lastUsed || 'Never'}`);
            console.log(`   Total requests: ${selectedAccount.totalRequests || 0}`);

            // Simulate using the account for Twitter API calls
            console.log('   📡 Simulating Twitter API fetch...');

            // Mark the account as used (this updates the timestamp)
            await twitterAccountManager.markAccountAsUsed(selectedAccount.accountId);

            console.log('   ✅ Account marked as used\n');

            // Wait a moment to ensure timestamp differences
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('📈 Final account usage state:');
        const finalAccounts = await twitterAccountManager.getAllAccountsUsage();

        // Sort by last used to show the rotation order
        finalAccounts.sort((a, b) => {
            if (!a.lastUsed && !b.lastUsed) return 0;
            if (!a.lastUsed) return -1;
            if (!b.lastUsed) return 1;
            return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
        });

        finalAccounts.forEach((account, index) => {
            const isNext = index === 0;
            const prefix = isNext ? '👉' : '  ';

            console.log(`${prefix} ${account.accountId.slice(0, 20)}...`);
            console.log(`      Last used: ${account.lastUsed || 'Never'}`);
            console.log(`      Total requests: ${account.totalRequests || 0}`);

            if (isNext) {
                console.log(`      ⏭️  Will be used next`);
            }
        });

        console.log('\n✨ Demo completed! The system will automatically rotate accounts every 5 minutes.');
        console.log('   The account with the earliest "last_request" timestamp gets selected next.');

    } catch (error) {
        console.error('❌ Demo failed:', error);

        if (error instanceof Error && error.message.includes('No Twitter accounts found')) {
            console.log('\n💡 To set up accounts:');
            console.log('   1. Add Twitter credentials to your .env file');
            console.log('   2. Run: npm run move-env-to-redis');
            console.log('   3. Run this demo again');
        }
    } finally {
        await twitterAccountManager.disconnect();
    }
}

// Run the demo
simulateTwitterFetch().catch(console.error);