/**
 * playwright-sniff
 * 
 * A monitoring library for Playwright that measures action times,
 * catches showstoppers, and generates comprehensive reports.
 */

export { PlaywrightSniff } from './monitor';
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
} from './types';
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
} from './utils';