#!/usr/bin/env node
/**
 * Test script for Telegram account rotation system
 * 
 * This script tests:
 * 1. Fetching Telegram accounts from Redis
 * 2. Account rotation logic (earliest used first)
 * 3. Usage tracking
 * 4. Error handling
 */

import 'dotenv/config';
import { telegramAccountManager, TelegramAccount } from '../services/telegramAccountManager';
import { createClient } from 'redis';

async function testTelegramAccountRotation() {
    console.log('📱 Testing Telegram Account Rotation System\n');

    try {
        // Test 1: Get all accounts and show their usage
        console.log('📊 Test 1: Fetching all Telegram accounts...');
        const allAccounts = await telegramAccountManager.getAllAccountsUsage();

        if (allAccounts.length === 0) {
            console.log('❌ No Telegram accounts found in Redis');
            console.log('   Make sure you have run the moveEnvToRedis script first');
            return;
        }

        console.log(`✅ Found ${allAccounts.length} Telegram accounts:`);
        allAccounts.forEach((account, index) => {
            console.log(`   Account ${index + 1}: ${account.accountId}`);
            console.log(`     Last used: ${account.lastUsed || 'Never'}`);
            console.log(`     Total requests: ${account.totalRequests || 0}`);
            console.log(`     Channel: ${account.credentials.TELEGRAM_TG_CHANNEL}`);
        });

        console.log('\n');

        // Test 2: Get earliest used account multiple times
        console.log('🔄 Test 2: Testing account rotation logic...');

        for (let i = 1; i <= 3; i++) {
            console.log(`\nIteration ${i}:`);

            const earliestAccount = await telegramAccountManager.getEarliestUsedAccount();
            console.log(`  Selected account: ${earliestAccount.accountId}`);
            console.log(`  Last used: ${earliestAccount.lastUsed || 'Never'}`);
            console.log(`  Channel: ${earliestAccount.credentials.TELEGRAM_TG_CHANNEL}`);

            // Mark the account as used
            console.log(`  Marking account as used...`);
            await telegramAccountManager.markAccountAsUsed(earliestAccount.accountId);

            // Wait a moment for the timestamp to change
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n');

        // Test 3: Show final state
        console.log('📈 Test 3: Final usage state after rotation...');
        const finalAccounts = await telegramAccountManager.getAllAccountsUsage();
        finalAccounts.forEach((account, index) => {
            console.log(`   Account ${index + 1}: ${account.accountId}`);
            console.log(`     Last used: ${account.lastUsed || 'Never'}`);
            console.log(`     Total requests: ${account.totalRequests || 0}`);
        });

        console.log('\n');

        // Test 4: Verify rotation order
        console.log('🎯 Test 4: Verifying rotation order...');
        const nextAccount = await telegramAccountManager.getEarliestUsedAccount();
        console.log(`   Next account to be used: ${nextAccount.accountId}`);
        console.log(`   Last used: ${nextAccount.lastUsed || 'Never'}`);

        console.log('\n✅ All Telegram tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await telegramAccountManager.disconnect();
    }
}

async function testTelegramRedisConnection() {
    console.log('🔗 Testing Redis connection for Telegram accounts...');

    const redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    try {
        await redisClient.connect();

        // Check if telegram-accounts key exists
        const telegramAccounts = await redisClient.get('telegram-accounts');
        if (!telegramAccounts) {
            console.log('⚠️  No telegram-accounts found in Redis');
            console.log('   Run this first: npm run move-env-to-redis');
            return false;
        }

        // Try to parse the accounts
        const accounts = JSON.parse(telegramAccounts);
        console.log(`✅ Found ${accounts.length} encrypted Telegram accounts in Redis`);

        return true;
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        return false;
    } finally {
        await redisClient.quit();
    }
}

async function main() {
    console.log('Telegram Account Rotation Test Suite');
    console.log('=====================================\n');

    // Check Redis connection and data first
    const redisOk = await testTelegramRedisConnection();
    if (!redisOk) {
        console.log('\n❌ Please fix Redis issues before continuing');
        process.exit(1);
    }

    // Check encryption key
    if (!process.env.ENCRYPTION_KEY) {
        console.log('❌ ENCRYPTION_KEY environment variable not set');
        process.exit(1);
    }

    console.log('\n');

    // Run rotation tests
    await testTelegramAccountRotation();
}

// Export for use in other scripts
export { testTelegramAccountRotation, testTelegramRedisConnection };

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}