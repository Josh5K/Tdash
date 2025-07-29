export interface DatadogConfig {
  apiKey?: string;
  appKey?: string;
  site?: string;
  prefix?: string;
  tags?: string[];
}

export interface DriftMetrics {
  workspace: string;
  hasDrift: boolean;
  addCount: number;
  changeCount: number;
  destroyCount: number;
  totalChanges: number;
  repository?: string;
  environment?: string;
}

export class DatadogMetricsService {
  private config: DatadogConfig;
  private baseUrl: string;

  constructor(config: DatadogConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.DD_API_KEY,
      appKey: config.appKey || process.env.DD_APP_KEY,
      site: config.site || process.env.DD_SITE || 'datadoghq.com',
      prefix: config.prefix || 'tdash.',
      tags: config.tags || [],
    };

    this.baseUrl = `https://api.${this.config.site}`;
  }

  /**
   * Send state drift metrics to Datadog via HTTP API
   */
  async sendDriftMetrics(metrics: DriftMetrics): Promise<void> {
    if (!this.config.apiKey) {
      console.warn('Datadog API key not configured, skipping metrics send');
      return;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const tags = this.buildTags(metrics);
      
      const metricData = [
        {
          metric: `${this.config.prefix}state_drift.has_drift`,
          points: [[timestamp, metrics.hasDrift ? 1 : 0]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}state_drift.add_count`,
          points: [[timestamp, metrics.addCount]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}state_drift.change_count`,
          points: [[timestamp, metrics.changeCount]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}state_drift.destroy_count`,
          points: [[timestamp, metrics.destroyCount]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}state_drift.total_changes`,
          points: [[timestamp, metrics.totalChanges]],
          tags: tags,
          type: 'gauge'
        }
      ];

      await this.sendMetrics(metricData);
      
      // Send drift event if there are changes
      if (metrics.hasDrift) {
        await this.sendEvent({
          title: 'Terraform State Drift Detected',
          text: `Workspace ${metrics.workspace} has ${metrics.totalChanges} pending changes`,
          alert_type: 'warning',
          tags: tags,
          aggregation_key: `drift_${metrics.workspace}`,
        });
      }

      console.log(`📊 Sent drift metrics for workspace: ${metrics.workspace}`);
    } catch (error) {
      console.warn(`Failed to send drift metrics for workspace ${metrics.workspace}:`, error);
    }
  }

  /**
   * Send metrics for multiple workspaces
   */
  async sendBulkDriftMetrics(metricsList: DriftMetrics[]): Promise<void> {
    if (!this.config.apiKey) {
      console.warn('Datadog API key not configured, skipping bulk metrics send');
      return;
    }

    console.log(`📊 Sending drift metrics for ${metricsList.length} workspaces...`);
    
    const promises = metricsList.map(metrics => this.sendDriftMetrics(metrics));
    await Promise.allSettled(promises);
    
    console.log('✅ Bulk drift metrics sent successfully');
  }

  /**
   * Send summary metrics for the entire repository
   */
  async sendRepositorySummaryMetrics(
    workspaces: DriftMetrics[],
    repository?: string
  ): Promise<void> {
    if (!this.config.apiKey) {
      console.warn('Datadog API key not configured, skipping summary metrics send');
      return;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const totalWorkspaces = workspaces.length;
      const workspacesWithDrift = workspaces.filter(w => w.hasDrift).length;
      const totalChanges = workspaces.reduce((sum, w) => sum + w.totalChanges, 0);
      
      const tags = [
        `repository:${repository || 'unknown'}`,
        ...this.config.tags || []
      ];

      const metricData = [
        {
          metric: `${this.config.prefix}repository.total_workspaces`,
          points: [[timestamp, totalWorkspaces]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}repository.workspaces_with_drift`,
          points: [[timestamp, workspacesWithDrift]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}repository.total_pending_changes`,
          points: [[timestamp, totalChanges]],
          tags: tags,
          type: 'gauge'
        },
        {
          metric: `${this.config.prefix}repository.drift_percentage`,
          points: [[timestamp, totalWorkspaces > 0 ? (workspacesWithDrift / totalWorkspaces) * 100 : 0]],
          tags: tags,
          type: 'gauge'
        }
      ];

      await this.sendMetrics(metricData);
      console.log(`📊 Sent repository summary metrics for ${repository || 'unknown'}`);
    } catch (error) {
      console.warn('Failed to send repository summary metrics:', error);
    }
  }

  private buildTags(metrics: DriftMetrics): string[] {
    const tags = [
      `workspace:${metrics.workspace}`,
      ...this.config.tags || []
    ];

    if (metrics.repository) {
      tags.push(`repository:${metrics.repository}`);
    }

    if (metrics.environment) {
      tags.push(`environment:${metrics.environment}`);
    }

    return tags;
  }

  private async sendMetrics(metricData: any[]): Promise<void> {
    const url = `${this.baseUrl}/api/v1/series`;
    const payload = { series: metricData };
    
    console.log(`🔍 Sending ${metricData.length} metrics to Datadog API...`);
    console.log(`🔍 API URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey!,
        'DD-APP-KEY': this.config.appKey || '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Datadog API Error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to send metrics: ${response.status} ${errorText}`);
    }
    
    console.log(`✅ Successfully sent ${metricData.length} metrics to Datadog`);
  }

  private async sendEvent(eventData: any): Promise<void> {
    const url = `${this.baseUrl}/api/v1/events`;
    
    console.log(`🔍 Sending event to Datadog API...`);
    console.log(`🔍 Event: ${eventData.title}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey!,
        'DD-APP-KEY': this.config.appKey || '',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Datadog Event API Error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to send event: ${response.status} ${errorText}`);
    }
    
    console.log(`✅ Successfully sent event to Datadog`);
  }

  /**
   * Check if Datadog metrics are properly configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }
} 