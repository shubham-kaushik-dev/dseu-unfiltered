import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import LiveChatMessage from '../models/LiveChatMessage.js';
import Confession from '../models/Confession.js';
import Meme from '../models/Meme.js';
import Poll from '../models/Poll.js';
import Report from '../models/Report.js';
import AdminLog from '../models/AdminLog.js';
import Settings from '../models/Settings.js';

/**
 * Performs a database JSON export dump of all collections
 * and saves status details into Settings database.
 */
export async function runDatabaseBackup() {
  if (process.env.VERCEL === '1') {
    console.log('[Backup] Database backups to disk are disabled in serverless/Vercel environments.');
    return {
      timestamp: new Date().toISOString(),
      status: 'skipped',
      filesCount: 0,
      sizeKb: 0,
      message: 'Backups are disabled in serverless/Vercel environments.'
    };
  }

  const backupRoot = process.env.BACKUP_PATH || './backups';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(process.cwd(), backupRoot, `backup-${timestamp}`);

  try {
    // 1. Create backup directory
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }

    // 2. Fetch all collections
    const collections = {
      users: await User.find({}),
      livechatmessages: await LiveChatMessage.find({}),
      confessions: await Confession.find({}),
      memes: await Meme.find({}),
      polls: await Poll.find({}),
      reports: await Report.find({}),
      adminlogs: await AdminLog.find({}),
      settings: await Settings.find({})
    };

    // 3. Write each collection to a JSON file
    let totalFiles = 0;
    let totalSize = 0;

    for (const [name, docs] of Object.entries(collections)) {
      const filePath = path.join(backupFolder, `${name}.json`);
      const dataStr = JSON.stringify(docs, null, 2);
      fs.writeFileSync(filePath, dataStr);
      
      totalFiles++;
      totalSize += Buffer.byteLength(dataStr);
    }

    const kbSize = Math.round((totalSize / 1024) * 100) / 100;
    const backupMetadata = {
      status: 'success',
      timestamp: new Date(),
      folder: backupFolder,
      filesCount: totalFiles,
      sizeKb: kbSize,
      error: null
    };

    // 4. Save metadata to Settings
    await Settings.findOneAndUpdate(
      { key: 'last_backup_status' },
      { value: backupMetadata },
      { upsert: true, new: true }
    );

    console.log(`[Backup Service] Database backup completed: ${backupFolder} (${kbSize} KB)`);
    return backupMetadata;

  } catch (error) {
    console.error('[Backup Service] Backup failed:', error);
    
    const failedMetadata = {
      status: 'failed',
      timestamp: new Date(),
      folder: backupFolder,
      filesCount: 0,
      sizeKb: 0,
      error: error.message
    };

    await Settings.findOneAndUpdate(
      { key: 'last_backup_status' },
      { value: failedMetadata },
      { upsert: true, new: true }
    );

    return failedMetadata;
  }
}

/**
 * Initializes automatic daily backups check (every 24 hours)
 */
export function initBackupScheduler() {
  // Check every 24 hours (24 * 60 * 60 * 1000)
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  
  setInterval(async () => {
    console.log('[Backup Scheduler] Triggering automatic daily database backup...');
    await runDatabaseBackup();
  }, INTERVAL_MS);
}
