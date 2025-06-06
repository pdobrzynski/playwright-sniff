import { Locator, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { 
  ActionTiming, 
  Failure, 
  LogLevel, 
  RequestDetails, 
  ShowStopper, 
  SniffConfig, 
  SniffOptions, 
  SniffReport, 
  TestReport
} from './types';
import { calculateAverage, cleanErrorMessage, defaultLogger } from './utils';
import { generateReportHTML } from './html-report';

declare module '@playwright/test' {
  interface PlaywrightWorkerOptions {
    sniffOptions?: SniffOptions;
  }
}
/**
 * PlaywrightSniff - A monitoring tool for Playwright actions
 */
export class PlaywrightSniff {
  private page: Page;
  private options: Required<SniffOptions>;
  private failures: Failure[] = [];
  private showStoppers: ShowStopper[] = [];
  private requestStartTimes: Record<string, number> = {};
  private requestDurations: number[] = [];
  private detailedRequestDurations: RequestDetails[] = [];
  private timings: ActionTiming[] = [];
  private isMonitoring: boolean = false;
  private testName: string;
  private reportData: TestReport[] = [];
  private logger: (message: string, level: LogLevel) => void;

  /**
   * Default options for monitoring
   */
  public static readonly DEFAULT_OPTIONS: Required<SniffOptions> = {
    slowThreshold: 2000,
    captureScreenshots: true,
    screenshotDir: './screenshots',
    outputFile: 'sniffing-results.json',
    outputHTML: 'sniffing-report.html',
    logger: defaultLogger
  };

  /**
   * Creates a new PlaywrightSniff instance
   */
  constructor(config: SniffConfig) {
    this.page = config.page;
    this.options = { ...PlaywrightSniff.DEFAULT_OPTIONS, ...config.options };
    this.logger = this.options.logger;
    
    // Create screenshot directory if needed
    if (this.options.captureScreenshots) {
      if (!fs.existsSync(this.options.screenshotDir)) {
        fs.mkdirSync(this.options.screenshotDir, { recursive: true });
      }
    }
  }

  /**
   * Start monitoring page actions
   */
  public async start(): Promise<void> {
    if (this.isMonitoring) {
      this.logger('Monitoring already started', LogLevel.WARN);
      return;
    }

    this.failures = [];
    this.showStoppers = [];
    this.requestStartTimes = {};
    this.requestDurations = [];
    this.detailedRequestDurations = [];
    this.timings = [];
    this.isMonitoring = true;
    this.reportData = [];
    
    this.logger(`Started monitoring Playwright actions for ${this.testName}`, LogLevel.INFO);
    
    // Set up listeners
    await this.setupSniffingListeners();
  }

  /**
   * Stop monitoring page actions
   */
  public stop(): void {
    if (!this.isMonitoring) {
      this.logger('Monitoring not started', LogLevel.WARN);
      return;
    }

    this.saveReport();
    this.generateHTMLReport();
    this.isMonitoring = false;
    this.logger(`Stopped monitoring Playwright actions for ${this.testName}`, LogLevel.INFO);

    if(this.hasShowStoppers()) {
      throw new Error('Test failed due to showstoppers');
    }
  }

  /**
   * Measure the execution time of an action
   * @param action Function to execute and measure
   * @param label Label to identify the action
   */
  public async measureAction(action: () => Promise<void>, label: string): Promise<void> {
  if (!this.isMonitoring) {
    this.logger('Monitoring not started', LogLevel.WARN);
    return action();
  }

  const start = Date.now();
  try {
    await action();
    
    const duration = Date.now() - start;
    const isSlow = duration > this.options.slowThreshold;
    
    this.timings.push({ label, duration, slow: isSlow, failed: false });
    
    if (isSlow) {
      this.logger(
        `Slow action detected: ${label} took ${duration}ms (threshold: ${this.options.slowThreshold}ms)`, 
        LogLevel.WARN
      );
    }
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = cleanErrorMessage(error);
    
    this.timings.push({ label, duration: 0, slow: false, failed: true });
    
    this.showStoppers.push({
      label,
      criticalError: errorMessage
    });
    
    this.logger(`Showstopper detected during "${label}": ${errorMessage}`, LogLevel.ERROR);
    
    if (this.options.captureScreenshots) {
      await this.captureErrorScreenshot(label);
    }
    
    // Consider whether re-throwing is needed based on your use case
    // throw error;
  }
}

  /**
   * Add a custom failure
   */
  public addFailure(error: string, type: 'console' | 'request' | 'custom' = 'custom', metadata: Record<string, any> = {}): void {
    if (!this.isMonitoring) {
      this.logger('Monitoring not started', LogLevel.WARN);
      return;
    }
    
    this.failures.push({
      error,
      type,
      ...metadata
    });
    
    this.logger(`Failure added: ${error}`, LogLevel.WARN);
  }

  /**
   * Add a custom showstopper
   */
  public async addShowStopper(label: string, criticalError: string): Promise<void> {
    if (!this.isMonitoring) {
      this.logger('Monitoring not started', LogLevel.WARN);
      return;
    }
    
    const showStopper: ShowStopper = {
      label,
      criticalError
    };
    
    // Capture screenshot if enabled
    if (this.options.captureScreenshots) {
      const screenshotPath = await this.captureErrorScreenshot(label);
      if (screenshotPath) {
        showStopper.screenshot = screenshotPath;
      }
    }
    
    this.showStoppers.push(showStopper);
    this.logger(`Showstopper added: ${label} - ${criticalError}`, LogLevel.ERROR);
  }
  
  /**
   * Get the current sniffing results
   */
  public getResults(): TestReport {
    const timingsPassed = this.timings.filter(t => !t.failed);
    const avgLoadTime = calculateAverage(timingsPassed.map(t => t.duration));
    const avgRequestTime = calculateAverage(this.requestDurations);
    const slowRequests = this.detailedRequestDurations
      .filter(r => r.duration > this.options.slowThreshold)
      .sort((a, b) => b.duration - a.duration);
    
    return {
      reportData: [{
        timestamp: new Date().toLocaleString(),
        passed: this.showStoppers.length === 0,
        showStoppers: this.showStoppers,
        slowThreshold: this.options.slowThreshold,
        pageLoadSteps: this.timings,
        avgLoadTime,
        avgRequestTime,
        slowRequests,
        failures: this.failures, 
        testName: this.testName,
      }] 
    };
  }

  /**
   * Generate and save a report
   */
public saveReport(outputFile?: string): string {
  const results = this.getResults();
  const filePath = outputFile || this.options.outputFile;
  
  let existingData: { reportData: SniffReport[], testRunnerPid?: string } = { reportData: [] };
  const currentPpid = process.ppid?.toString();
  let shouldClear = false;
  
  if (fs.existsSync(filePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!existingData.reportData || !Array.isArray(existingData.reportData)) {
        existingData = { reportData: [] };
      }
      
      if (existingData.testRunnerPid && existingData.testRunnerPid !== currentPpid) {
        shouldClear = true;
        existingData = { reportData: [] };
      }
    } catch (error) {
      this.logger(`Error reading existing report: ${error}`, LogLevel.ERROR);
      existingData = { reportData: [] };
    }
  }
  
  existingData.testRunnerPid = currentPpid;
  existingData.reportData.push(results.reportData[0]);

  const action = fs.existsSync(filePath) && !shouldClear ? 'updated' : 'created';

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
  
  this.logger(`Report ${action} at ${filePath}`, LogLevel.INFO);
  
  return filePath;
}

/**
 * Generate HTML Report
 */
public generateHTMLReport(outputHTML?: string): void {
  let reportData: TestReport;
  const filePath = outputHTML || this.options.outputHTML;
  const jsonFilePath = this.options.outputFile;
  try {
      const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
      reportData = JSON.parse(rawData);
  } catch (error) {
      this.logger(`Error reading existing json report: ${error}`, LogLevel.ERROR);
      process.exit(1);
  }

  const html = generateReportHTML(reportData);
  const action = fs.existsSync(filePath) ? 'updated' : 'created';
  fs.writeFileSync(filePath, html);

  this.logger(`HTML Report ${action} at ${filePath}`, LogLevel.INFO);
}

  /**
   * Check if there are any showstoppers
   */
  public hasShowStoppers(): boolean {
    return this.showStoppers.length > 0;
  }

  /**
   * Get list of showstoppers
   */
  public getShowStoppers(): ShowStopper[] {
    return this.showStoppers;
  }

  public setTestName(name: string): void {
    this.testName = name;
  }
  /**
   * Setup all listeners for sniffing
   */
  private async setupSniffingListeners(): Promise<void> {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.failures.push({
          error: msg.text(),
          type: 'console'
        });
      }
    });
    
    this.page.on('requestfailed', async request => {
      const response = await request.response();
      const status = response?.status();
      const url = request.url();
      const errorText = request.failure()?.errorText || 'Unknown error';

      this.failures.push({
        error: `${errorText}`,
        requestUrl: url,
        requestStatus: status || null,
        requestMethod: request.method(),
        type: 'request',
      });
    });
    
    this.page.on('request', request => {
      this.requestStartTimes[request.url()] = Date.now();
    });
    
    this.page.on('requestfinished', response => {
      const url = response.url();
      const method = response.method();
      if (this.requestStartTimes[url]) {
        const duration = Date.now() - this.requestStartTimes[url];
        this.requestDurations.push(duration);
        this.detailedRequestDurations.push({ url, duration, method });
      }
    });

    this.page.on('response', async (response) => {
      const status = response.status();
      if (status >= 500 && status < 600) {
        const url = response.url();
        const method = response.request().method();
        let body = '[body unreadable]';
        try {
          body = await response.text();
        } catch (e) { /* ignore */ }
        
        await this.addShowStopper(
          `${method} - ${url}`,
          `Status: ${status} - Body: ${body.substring(0, 100)}...`
        );
      }
    });
  }

  /**
   * Setup handler for alerts on the page
   */
  private setupAlertHandler(locator: Locator): void {
    try {
      this.page.addLocatorHandler(locator, async () => {
        const alertMessage = await locator.allTextContents();
        await this.addShowStopper('Unexpected alert', alertMessage ? alertMessage.join(', ') : '');
      });
    } catch (e) {
      this.logger('Could not set up alert handler', LogLevel.WARN);
    }
  }

  /**
   * Capture a screenshot for an error
   */
  private async captureErrorScreenshot(label: string): Promise<string | undefined> {
    try {
      if (!fs.existsSync(this.options.screenshotDir)) {
        fs.mkdirSync(this.options.screenshotDir, { recursive: true });
      }
      
      const safeName = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
      const fileName = `error_${safeName}_${timestamp}.png`;
      const filePath = path.join(this.options.screenshotDir, fileName);
      
      await this.page.screenshot({ path: filePath });
      return filePath;
    } catch (e) {
      this.logger(`Failed to capture error screenshot: ${e}`, LogLevel.ERROR);
      return undefined;
    }
  }
}