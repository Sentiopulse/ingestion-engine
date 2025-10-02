#!/usr/bin/env node
/**
 * Demo script showing Telegram account rotation in action
 *
 * This simulates the 5-minute rotation behavior by:
 * 1. Getting the earliest used Telegram account
 * 2. Using it for a "fetch operation" (simulated)
 * 3. Marking it as used
 * 4. Repeating to show rotation
 */

import 'dotenv/config';
import { telegramAccountManager } from '../services/telegramAccountManager';

async function simulateTelegramFetch() {
  console.log('📱 Telegram Account Rotation Demo');
  console.log('=================================\n');

  try {
    // Show initial state
    console.log('📊 Initial account usage state:');
    const initialAccounts = await telegramAccountManager.getAllAccountsWithCredentials();
    initialAccounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.accountId}`);
      console.log(`      Last used: ${account.lastUsed || 'Never'}`);
      console.log(`      Total requests: ${account.totalRequests || 0}`);
      console.log(`      Channel: ${account.credentials.TELEGRAM_TG_CHANNEL}`);
    });

    console.log('\n🔄 Simulating 5-minute rotation cycles...\n');

    // Simulate 5 fetch cycles (representing 5-minute intervals)
    for (let cycle = 1; cycle <= 5; cycle++) {
      console.log(`--- Cycle ${cycle} (${cycle * 5} minutes) ---`);

      // Get the account that should be used (earliest used)
      const selectedAccount = await telegramAccountManager.getEarliestUsedAccount();

      console.log(`🎯 Selected: ${selectedAccount.accountId}`);
      console.log(`   Last used: ${selectedAccount.lastUsed || 'Never'}`);
      console.log(`   Total requests: ${selectedAccount.totalRequests || 0}`);
      console.log(`   Channel: ${selectedAccount.credentials.TELEGRAM_TG_CHANNEL}`);

      // Simulate using the account for Telegram API calls
      console.log('   📡 Simulating Telegram API fetch...');

      // Mark the account as used (this updates the timestamp)
      await telegramAccountManager.markAccountAsUsed(selectedAccount.accountId);

      console.log('   ✅ Account marked as used\n');

      // Wait a moment to ensure timestamp differences
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('📈 Final account usage state:');
    const finalAccounts = await telegramAccountManager.getAllAccountsWithCredentials();

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

      console.log(`${prefix} ${account.accountId}`);
      console.log(`      Last used: ${account.lastUsed || 'Never'}`);
      console.log(`      Total requests: ${account.totalRequests || 0}`);
      console.log(`      Channel: ${account.credentials.TELEGRAM_TG_CHANNEL}`);

      if (isNext) {
        console.log(`      ⏭️  Will be used next`);
      }
    });

    console.log('\n✨ Demo completed! The system will automatically rotate Telegram accounts every 5 minutes.');
    console.log('   The account with the earliest "last_request" timestamp gets selected next.');
  } catch (error) {
    console.error('❌ Demo failed:', error);

    if (error instanceof Error && error.message.includes('No Telegram accounts found')) {
      console.log('\n💡 To set up Telegram accounts:');
      console.log('   1. Add Telegram credentials to your .env file');
      console.log('   2. Run: npm run move-env-to-redis');
      console.log('   3. Run this demo again');
    }
  } finally {
    await telegramAccountManager.disconnect();
  }
}

// Run the demo
simulateTelegramFetch().catch(console.error);
