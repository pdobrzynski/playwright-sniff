import { Page } from '@playwright/test';

/**
 * Configuration for the PlaywrightSniff instance
 */
export interface SniffConfig {
  /** The Playwright page to monitor */
  page: Page;
  
  /** Monitoring options */
  options?: SniffOptions;
}

/**
 * Options to configure the monitoring behavior
 */
export interface SniffOptions {
  /** Performance threshold in milliseconds for marking actions as slow (default 2000ms) */
  slowThreshold?: number;
  
  /** Whether to capture screenshots when encountering showstoppers (default true) */
  captureScreenshots?: boolean;
  
  /** Directory where screenshots will be saved (default './screenshots') */
  screenshotDir?: string;
  
  /** Output file for reports (default 'sniffing-results.json') */
  outputFile?: string;
  
  /** Output file for HTML report (default 'sniffing-report.html') */
  outputHTML?: string;
  
  /** Custom logger function */
  logger?: (message: string, level: LogLevel) => void;
}

/**
 * Log levels for the monitoring
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Data structure for timing actions
 */
export interface ActionTiming {
  /** Label identifying the action */
  label: string;
  
  /** Duration of the action in milliseconds */
  duration: number;
  
  /** Whether this action is slow based on threshold */
  slow: boolean;
  
  /** Don't include failed steps to Load Timings */
  failed?: boolean;
}

/**
 * Data structure for failures
 */
export interface Failure {
  /** Error description */
  error: string | undefined;
  
  /** Type of failure */
  type: 'console' | 'request' | 'custom';
  
  /** URL of the request (if applicable) */
  requestUrl?: string;
  
  /** Status code of the request (if applicable) */
  requestStatus?: number | null;
  
  /** HTTP method of the request (if applicable) */
  requestMethod?: string;
}

/**
 * Data structure for critical showstopper errors
 */
export interface ShowStopper {
  /** Label identifying where the error occurred */
  label: string;
  
  /** Description of the critical error */
  criticalError: string;
  
  /** Path to screenshot if captured */
  screenshot?: string;
}

/**
 * Data structure for request details
 */
export interface RequestDetails {
  /** URL of the request */
  url: string;
  
  /** Duration of the request in milliseconds */
  duration: number;
  
  /** HTTP method of the request */
  method: string;
}

/**
 * Report data structure
 */
export interface SniffReport {
  /** Timestamp of the report */
  timestamp: string;
  
  /** Whether the test passed (no showstoppers) */
  passed: boolean;
  
  /** List of showstoppers */
  showStoppers: ShowStopper[];
  
  /** Slow threshold in milliseconds */
  slowThreshold: number;
  
  /** List of page load steps with timing */
  pageLoadSteps: ActionTiming[];
  
  /** Average load time */
  avgLoadTime: string | null;
  
  /** Average request time */
  avgRequestTime: string | null;
  
  /** List of slow requests */
  slowRequests: RequestDetails[];
  
  /** List of failures */
  failures: Failure[];

  /** Name of the test */
  testName: string;
}

export interface TestReport {  
  /** Report data for the test */
  reportData: SniffReport[];
}