import fs from 'fs';
import path from 'path';

const isVercel = process.env.VERCEL === '1';

const logDir = !isVercel ? path.join(process.cwd(), 'logs') : null;
if (!isVercel && logDir && !fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err.message);
  }
}

const logFile = logDir ? path.join(logDir, 'app.log') : null;

function writeLog(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  
  const logStr = JSON.stringify(logEntry);
  
  // Console logging
  if (level === 'ERROR' || level === 'WARN') {
    console.error(logStr);
  } else {
    console.log(logStr);
  }
  
  // File logging (disabled on Vercel)
  if (!isVercel && logFile) {
    try {
      fs.appendFileSync(logFile, logStr + '\n');
    } catch (err) {
      console.error('Failed to append log to file:', err);
    }
  }
}

export const logger = {
  info: (message, meta) => writeLog('INFO', message, meta),
  warn: (message, meta) => writeLog('WARN', message, meta),
  error: (message, meta) => writeLog('ERROR', message, meta),
  admin: (message, meta) => writeLog('ADMIN', message, meta)
};
