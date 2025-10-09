#!/usr/bin/env ts-node
import 'dotenv/config';
import { startTelegramCron } from '../src/index';
import { fetchHomeTimeline } from '../src/twitterApi';
import { twitterAccountManager } from '../src/services/twitterAccountManager';
import { simulateTwitterFetch } from '../src/tests/rotationDemo';
import { simulateTelegramFetch } from '../src/tests/telegramRotationDemo';

async function run() {
  const command = process.argv[2];

  switch (command) {
    case 'run-telegram':
      console.log('Running Telegram ingestion flow...');
      await startTelegramCron();
      break;
    case 'run-twitter':
      console.log('Running Twitter ingestion flow...');
      try {
        const account = await twitterAccountManager.getEarliestUsedAccount();
        const data = await fetchHomeTimeline([], account);
        console.log(`Fetched ${data.length} tweets using account: ${account.accountId}`);
        const allAccounts = await twitterAccountManager.getAllAccountsUsage();
        console.log('All Twitter accounts usage:');
        allAccounts.forEach((acc, index) => {
          console.log(`  Account ${index + 1} (${acc.accountId}):`);
          console.log(`    Total requests: ${acc.totalRequests}`);
          console.log(`    Last used: ${acc.lastUsed || 'Never'}`);
        });
      } catch (err) {
        console.error('Twitter ingestion failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      } finally {
        await twitterAccountManager.disconnect();
      }
      break;
    case 'run-rotation':
      console.log('Running rotation demos...');
      await simulateTwitterFetch();
      await simulateTelegramFetch();
      break;
    default:
      console.log('Usage: ts-node bin/run.ts [run-twitter|run-telegram|run-rotation]');
      process.exit(1);
  }
}

run().catch(console.error);
