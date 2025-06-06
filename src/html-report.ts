import { TestReport } from "./types";
import { VERSION } from "./utils";

export function generateReportHTML(data: TestReport): string {
  // Format timestamp for better readability
  const formattedTimestamp = new Date().toLocaleString();
  
  // Aggregate data across all tests
  const allSlowRequests = data.reportData.flatMap(report => report.slowRequests);
  const allFailures = data.reportData.flatMap(report => report.failures);
  const allShowStoppers = data.reportData.flatMap(report => 
    report.showStoppers.map(s => ({ ...s, testName: report.testName }))
  );
  
  // Calculate overall average metrics
  const avgLoadTimeTotal = data.reportData
    .filter(r => r.avgLoadTime)
    .reduce((sum, r) => sum + parseFloat(r.avgLoadTime || "0"), 0) / 
    data.reportData.filter(r => r.avgLoadTime).length || 0;
  
  const avgRequestTimeTotal = data.reportData
    .filter(r => r.avgRequestTime)
    .reduce((sum, r) => sum + parseFloat(r.avgRequestTime || "0"), 0) / 
    data.reportData.filter(r => r.avgRequestTime).length || 0;
  
  // Check if any test has failed
  const overallPassed = data.reportData.every(r => r.passed);
  
  // Use the slow threshold from the first report (assuming it's the same for all)
  const slowThreshold = data.reportData[0].slowThreshold;
  
  // Format durations with color coding based on thresholds
  const formatDuration = (duration: number | string, threshold: number): string => {
    const durationNum = typeof duration === 'string' ? parseFloat(duration) : duration;
    if (durationNum > threshold * 1.5) {
      return `<span class="critical">${duration}ms</span>`;
    } else if (durationNum > threshold) {
      return `<span class="warning">${duration}ms</span>`;
    }
    return `<span class="normal">${duration}ms</span>`;
  };
  
  // Generate show stopper sections per test
  const showStopperSections = data.reportData.map((report, index) => {
    if (report.showStoppers.length === 0) return '';
    
    const showStopperRows = report.showStoppers.map(s => `
      <tr class="error-row">
        <td><strong>${s.label}</strong></td>
        <td>${s.criticalError || 'Unknown error'}</td>
      </tr>`).join("");
    
    return `
      <div class="test-section">
        <div class="test-header" data-toggle="collapse" data-target="showStopper-${index}">
          <h4 class="test-name">Test: ${report.testName} <span class="toggle-indicator">▼</span></h4>
          <div class="test-badge">${report.showStoppers.length} issues</div>
        </div>
        <div id="showStopper-${index}" class="collapse-content hide">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Error Message</th>
              </tr>
            </thead>
            <tbody>
              ${showStopperRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");
  
  // Generate page load steps sections per test
  const pageLoadSections = data.reportData.map((report, index) => {
    const pageLoadRows = report.pageLoadSteps.map(s => `
      <tr class="${s.slow || s.failed ? 'slow-row' : ''}">
        <td>${s.label}</td>
        ${s.failed ? `<td><span class="critical">✗</span></td>` : `<td>${formatDuration(s.duration, slowThreshold)}</td>`}
      </tr>`).join("");
    
    // Calculate metrics for this test's page loads
    const slowSteps = report.pageLoadSteps.filter(s => s.slow).length;
    
    return `
      <div class="test-section">
        <div class="test-header" data-toggle="collapse" data-target="pageLoad-${index}">
          <h4 class="test-name">Test: ${report.testName} <span class="toggle-indicator">▼</span></h4>
          <div class="test-badge">${report.pageLoadSteps.length} steps${slowSteps > 0 ? `, ${slowSteps} slow` : ''}</div>
        </div>
        <div id="pageLoad-${index}" class="collapse-content hide">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${pageLoadRows || `<tr><td colspan="2" class="empty-table-message">No page load data available</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");
  
  // Generate slow request rows with more details and formatting
  const slowRequestRows = allSlowRequests.map(r => `
    <tr class="slow-request">
      <td class="url-cell" title="${r.url}">${truncateUrl(r.url, 80)}</td>
      <td>${r.method}</td>
      <td>${formatDuration(r.duration, slowThreshold)}</td>
    </tr>`).join("");
  
  // Generate failure rows with enhanced classification and styling
  const failureRows = allFailures.map(f => {
    const severityClass = f.type === 'request' ? 'error-row' : 'warning-row';
    return `
    <tr class="error-row">
      <td>${f.type}</td>
      <td>${f.error}</td>
      ${
        f.type === 'request' ? `
          <td class="url-cell" title="${f.requestUrl || ''}">${truncateUrl(f.requestUrl || '', 60)}</td>
          <td>${f.requestMethod || ''}</td>
          <td>${f.requestStatus ? `<span class="status-code code-${Math.floor(f.requestStatus/100)}xx">${f.requestStatus}</span>` : ''}</td>` 
          : `<td colspan="3" class="empty-cell">N/A</td>`
      }
    </tr>`;
  }).join("");
  
  // Helper function to truncate URLs for better display
  function truncateUrl(url: string, maxLength: number): string {
    if (url.length <= maxLength) return url;
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      if (domain.length + 3 >= maxLength) {
        return domain.substring(0, maxLength - 3) + '...';
      }
      const availableChars = maxLength - domain.length - 3;
      return `${domain}/...${path.substring(path.length - availableChars)}`;
    } catch (e) {
      return url.substring(0, maxLength - 3) + '...';
    }
  }

  function calculateBadnessPercentage(
    actualLoadTime: number,
    acceptableThreshold: number,
    maxPercentage: number = 100,
    badMultiplier: number = 2
  ): number {
    // If actual time is less than or equal to threshold, return 0% (good)
    if (actualLoadTime <= acceptableThreshold) {
      return 0;
    }
    
    // Calculate how much the actual time exceeds the threshold
    const exceedAmount = actualLoadTime - acceptableThreshold;
    
    // Calculate the maximum exceed amount that would result in 100% badness
    const maxExceedAmount = acceptableThreshold * (badMultiplier - 1);
    
    // Calculate percentage, capped at maxPercentage
    const percentage = Math.min(
      (exceedAmount / maxExceedAmount) * maxPercentage,
      maxPercentage
    );
    
    return Math.round(percentage * 100) / 100; // Round to 2 decimal places
  }
  const fillPercentage = calculateBadnessPercentage(avgLoadTimeTotal, data.reportData[0].slowThreshold)
  
  // Determine color based on percentage (gradient from green to red)
    const getColorClass = (percentage) => {
      if (percentage <= 10) return "excellent"; // 0-20% of threshold
      if (percentage <= 30) return "good";      // 20-40% of threshold
      if (percentage <= 50) return "moderate";  // 40-60% of threshold
      if (percentage <= 70) return "slow";      // 60-80% of threshold
      return "very-slow";                       // 80-100%+ of threshold
    };
  
  const colorClass = getColorClass(fillPercentage);

  // Visual performance indicators
  const performanceIndicator = overallPassed ? 
    `<div class="performance-indicator good">
       <span class="indicator-icon">✓</span>
       <span class="indicator-text">All Tests Passed</span>
     </div>` :
    `<div class="performance-indicator bad">
       <span class="indicator-icon">✗</span>
       <span class="indicator-text">Critical Errors Detected</span>
     </div>`;
  
  // Create visual performance gauge based on load times
  const performanceGauge = `
    <div class="gauge-container">
      <div class="gauge">
        <div class="gauge-fill ${colorClass}" style="width: 100%"></div>
      </div>
      <div class="gauge-label">Performance: ${avgLoadTimeTotal.toFixed(2)}ms avg. load time</div>
    </div>
  `;

  // Test summary info (only numbers of passed/failed)
  const passedTests = data.reportData.filter(report => report.passed).length;
  const failedTests = data.reportData.length - passedTests;
  
  const testSummary = `
    <div class="test-summary">
      <div class="test-summary-overview">
        <div class="summary-box passed">
          <div class="summary-number">${passedTests}</div>
          <div class="summary-label">Tests Passed</div>
        </div>
        <div class="summary-box failed">
          <div class="summary-number">${failedTests}</div>
          <div class="summary-label">Tests Failed</div>
        </div>
      </div>
    </div>
  `;

  // Return the complete HTML report
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Sniff-Monitoring Report</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
        background: #f8f9fa;
      }
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
      }
      .report-header {
        background: #2c3e50;
        color: white;
        padding: 20px 0;
        margin-bottom: 30px;
      }
      .report-title {
        font-size: 28px;
        font-weight: 600;
      }
      .report-meta {
        display: flex;
        justify-content: space-between;
        opacity: 0.8;
        margin-top: 5px;
      }
      .card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        margin-bottom: 25px;
        overflow: hidden;
      }
      .card-header {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .card-title {
        margin: 0;
        font-size: 18px;
      }
      .card-body {
        padding: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }
      th {
        background: #f8f9fa;
        font-weight: 600;
      }
      tr:last-child td {
        border-bottom: none;
      }
      .error-row {
        background-color: rgba(255, 99, 71, 0.1);
      }
      .warning-row {
        background-color: rgba(255, 193, 7, 0.1);
      }
      .slow-row {
        background-color: rgba(255, 152, 0, 0.1);
      }
      .url-cell {
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      .url-cell:hover {
        text-decoration: underline;
        color: #3498db;
      }
      .critical {
        color: #e74c3c;
        font-weight: 600;
      }
      .warning {
        color: #f39c12;
      }
      .normal {
        color: #2ecc71;
      }
      .empty-table-message {
        text-align: center;
        color: #7f8c8d;
        padding: 20px;
        font-style: italic;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 25px;
      }
      .stat-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        text-align: center;
      }
      .stat-title {
        font-size: 14px;
        color: #777;
        margin-bottom: 5px;
      }
      .stat-value {
        font-size: 22px;
        font-weight: 600;
        margin-bottom: 5px;
      }
      .stat-footer {
        font-size: 12px;
        color: #999;
      }
      .gauge-container {
        margin-bottom: 25px;
      }
      .gauge {
        height: 10px;
        background: #eee;
        border-radius: 5px;
        margin-bottom: 5px;
        overflow: hidden;
      }
      .gauge-fill {
        height: 100%;
        transition: width 0.5s;
        border-radius: 5px;
        transition: width 0.5s ease;
      }

      /* Performance category colors */
      .gauge-fill.excellent {
        background: linear-gradient(to right, #2ecc71, #27ae60)
      }

      .gauge-fill.good {
        background: linear-gradient(to right, #58d68d, #f1c40f)
      }

      .gauge-fill.moderate {
        background: linear-gradient(to right, #e67e22, #d35400)
      }

      .gauge-fill.slow {
        background: linear-gradient(to right, #e74c3c, #c0392b)
      }

      .gauge-fill.very-slow {
      
        background: linear-gradient(to right, #c0392b, #922b21)
      }
      .gauge-label {
        font-size: 14px;
        color: #777;
        text-align: center;
      }
      .performance-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 25px;
        font-size: 18px;
        font-weight: 600;
      }
      .performance-indicator.good {
        background-color: rgba(46, 204, 113, 0.1);
        color: #27ae60;
      }
      .performance-indicator.bad {
        background-color: rgba(231, 76, 60, 0.1);
        color: #e74c3c;
      }
      .indicator-icon {
        font-size: 22px;
        margin-right: 10px;
      }
      .status-code {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .code-2xx {
        background-color: rgba(46, 204, 113, 0.2);
        color: #27ae60;
      }
      .code-3xx {
        background-color: rgba(52, 152, 219, 0.2);
        color: #2980b9;
      }
      .code-4xx, .code-5xx {
        background-color: rgba(231, 76, 60, 0.2);
        color: #e74c3c;
      }
      footer {
        margin-top: 40px;
        padding: 20px 0;
        border-top: 1px solid #eee;
        color: #777;
        font-size: 14px;
        text-align: center;
      }
      .card.danger {
        border-left: 4px solid #e74c3c;
      }
      .card.warning {
        border-left: 4px solid #f39c12;
      }
      .card.info {
        border-left: 4px solid #3498db;
      }
      .card.success {
        border-left: 4px solid #2ecc71;
      }
      .card.failure {
        border-left: 4px solid #ffb09c;
  }
      .test-section {
        border-bottom: 1px solid #eee;
        padding: 5px 0;
      }
      .test-section:last-child {
        border-bottom: none;
      }
      .test-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .test-header:hover {
        background-color: #f8f9fa;
      }
      .test-name {
        margin: 0;
        color: #2c3e50;
        display: flex;
        align-items: center;
      }
      .toggle-indicator {
        display: inline-block;
        margin-left: 8px;
        transition: transform 0.3s;
        font-size: 10px;
      }
      .collapse-content {
        transition: max-height 0.3s ease-out;
        overflow: hidden;
      }
      .collapse-content.hide {
        max-height: 0;
        overflow: hidden;
      }
      .collapse-content.show {
        max-height: 1000px;
      }
      .test-badge {
        background: #f0f0f0;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 12px;
        color: #666;
      }
      .test-summary {
        margin-bottom: 25px;
      }
      .test-summary-overview {
        display: flex;
        gap: 20px;
        justify-content: center;
        margin-top: 15px;
      }
      .summary-box {
        width: 180px;
        height: 140px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        text-align: center;
      }
      .summary-box.passed {
        background-color: rgba(46, 204, 113, 0.1);
        border-left: 4px solid #2ecc71;
      }
      .summary-box.failed {
        background-color: rgba(231, 76, 60, 0.1);
        border-left: 4px solid #e74c3c;
      }
      .summary-number {
        font-size: 48px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 10px;
      }
      .summary-box.passed .summary-number {
        color: #27ae60;
      }
      .summary-box.failed .summary-number {
        color: #e74c3c;
      }
      .summary-label {
        font-size: 16px;
        color: #555;
      }
    </style>
  </head>
  <body>
    <div class="report-header">
      <div class="container">
        <div class="report-title">Playwright Sniff Report</div>
        <div class="report-meta">
          <div class="timestamp">Generated: ${formattedTimestamp}</div>
        </div>
      </div>
    </div>
    
    <div class="container">
      ${performanceIndicator}
      
      ${testSummary}
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-title">Average Load Time</div>
          <div class="stat-value">${avgLoadTimeTotal.toFixed(2)}ms</div>
          <div class="stat-footer">Threshold: ${slowThreshold}ms</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-title">Average Request Time</div>
          <div class="stat-value">${avgRequestTimeTotal ? avgRequestTimeTotal.toFixed(2) + 'ms' : 'N/A'}</div>
          <div class="stat-footer">Across all network requests</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-title">Slow Requests</div>
          <div class="stat-value">${allSlowRequests.length}</div>
          <div class="stat-footer">Above ${slowThreshold}ms threshold</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-title">Failed Items</div>
          <div class="stat-value">${allFailures.length + allShowStoppers.length}</div>
          <div class="stat-footer">${allShowStoppers.length} critical, ${allFailures.length} non-critical</div>
        </div>
      </div>
      
      ${performanceGauge}
      
      ${allShowStoppers.length > 0 ? `
      <div class="card danger">
        <div class="card-header">
          <h3 class="card-title">Critical Errors</h3>
          <span class="card-count">${allShowStoppers.length} issues</span>
        </div>
        <div class="card-body">
          ${showStopperSections}
        </div>
      </div>
      ` : ''}
      
      <div class="card info">
        <div class="card-header">
          <h3 class="card-title">Page Load Timings</h3>
          <span>Threshold: ${slowThreshold}ms</span>
        </div>
        <div class="card-body">
          ${pageLoadSections}
        </div>
      </div>
      
      <div class="card warning">
        <div class="card-header">
          <h3 class="card-title">Slow Requests</h3>
          <span>Threshold: ${slowThreshold}ms</span>
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Method</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${slowRequestRows || `<tr><td colspan="3" class="empty-table-message">No slow requests detected</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="card ${allFailures.length > 0 ? 'failure' : 'success'}">
        <div class="card-header">
          <h3 class="card-title">Failures</h3>
          <span class="card-count">${allFailures.length} ${allFailures.length === 1 ? 'issue' : 'issues'}</span>
        </div>
        <div class="card-body">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Error</th>
                <th>URL</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${failureRows || `<tr><td colspan="5" class="empty-table-message">No failures detected</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <footer class="container">
      <p>Generated by Playwright Sniff v${VERSION}</p>
    </footer>
    
    <script>
      // Add interactivity - expand truncated URLs on click
      document.querySelectorAll('.url-cell').forEach(cell => {
        cell.addEventListener('click', function() {
          const fullUrl = this.getAttribute('title');
          const isExpanded = this.getAttribute('data-expanded') === 'true';
          
          if (isExpanded) {
            this.textContent = truncateUrl(fullUrl, this.classList.contains('small') ? 60 : 80);
            this.setAttribute('data-expanded', 'false');
          } else {
            this.textContent = fullUrl;
            this.setAttribute('data-expanded', 'true');
          }
        });
      });
      
      // Add collapsible functionality for test sections
      document.querySelectorAll('.test-header').forEach(header => {
        header.addEventListener('click', function() {
          const targetId = this.getAttribute('data-target');
          const content = document.getElementById(targetId);
          const indicator = this.querySelector('.toggle-indicator');
          
          if (content.classList.contains('show')) {
            content.classList.remove('show');
            content.classList.add('hide');
            indicator.style.transform = 'rotate(0deg)';
          } else {
            content.classList.remove('hide');
            content.classList.add('show');
            indicator.style.transform = 'rotate(-90deg)';
          }
        });
      });
      
      function truncateUrl(url, maxLength) {
        if (!url || url.length <= maxLength) return url;
        
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          const path = urlObj.pathname + urlObj.search;
          
          if (domain.length + 3 >= maxLength) {
            return domain.substring(0, maxLength - 3) + '...';
          }
          
          const availableChars = maxLength - domain.length - 3;
          return domain + '/...' + path.substring(path.length - availableChars);
        } catch (e) {
          // Not a valid URL, simple truncation
          return url.substring(0, maxLength - 3) + '...';
        }
      }
    </script>
  </body>
  </html>`;
}