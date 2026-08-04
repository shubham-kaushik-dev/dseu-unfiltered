import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'app.log');

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
  
  // File logging
  try {
    fs.appendFileSync(logFile, logStr + '\n');
  } catch (err) {
    console.error('Failed to append log to file:', err);
  }
}

export const logger = {
  info: (message, meta) => writeLog('INFO', message, meta),
  warn: (message, meta) => writeLog('WARN', message, meta),
  error: (message, meta) => writeLog('ERROR', message, meta),
  admin: (message, meta) => writeLog('ADMIN', message, meta)
};
