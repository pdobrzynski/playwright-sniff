/**
 * playwright-sniff
 * 
 * A monitoring library for Playwright that measures action times,
 * catches showstoppers, and generates comprehensive reports.
 */

export { PlaywrightSniff } from './src/monitor';
export { 
  ActionTiming, 
  Failure, 
  LogLevel, 
  RequestDetails, 
  ShowStopper, 
  SniffConfig, 
  SniffOptions, 
  SniffReport ,
  TestReport
} from './src/types';
export { 
  VERSION, 
  calculateAverage, 
  calculatePercentile, 
  cleanErrorMessage, 
  createDirectory, 
  defaultLogger, 
  formatDate, 
  formatDuration, 
  generateTimestamp 
} from './src/utils';