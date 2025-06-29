import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DriftResult {
  workspace: string;
  hasDrift: boolean;
  changes: {
    add: number;
    change: number;
    destroy: number;
  };
  details: string;
  lastChecked: Date;
  error?: string;
}

export class StateDriftDetector {
  private terraformPath: string;
  private driftCache: Map<string, DriftResult> = new Map();

  constructor(terraformPath: string) {
    this.terraformPath = terraformPath;
  }

  async checkDrift(workspace: string): Promise<DriftResult> {
    // Return cached result if available and recent (within 5 minutes)
    const cached = this.driftCache.get(workspace);
    if (cached && Date.now() - cached.lastChecked.getTime() < 5 * 60 * 1000) {
      return cached;
    }

    try {
      // Switch to the workspace
      await execAsync(`terraform workspace select ${workspace}`, {
        cwd: this.terraformPath,
        timeout: 10000 // 10 second timeout
      });

      // Run terraform plan with timeout
      // We use exec instead of execAsync to get the exit code
      const child_process = require('child_process');
      const planResult = child_process.spawnSync('terraform', ['plan', '-detailed-exitcode', '-lock=false'], {
        cwd: this.terraformPath,
        encoding: 'utf-8',
        timeout: 60000
      });

      const exitCode = planResult.status;
      const output = planResult.stdout || planResult.stderr || '';

      if (exitCode === 0 || exitCode === 2) {
        // 0: no changes, 2: changes present
        const result = this.parsePlanOutput(output, workspace);
        this.driftCache.set(workspace, result);
        return result;
      } else {
        // exit code 1: error
        let errorMessage = 'Failed to check drift';
        if (planResult.error) {
          errorMessage = `Drift check failed: ${planResult.error.message}`;
        } else if (planResult.stderr) {
          errorMessage = `Drift check failed: ${planResult.stderr}`;
        }
        const errorResult: DriftResult = {
          workspace,
          hasDrift: false,
          changes: { add: 0, change: 0, destroy: 0 },
          details: errorMessage,
          lastChecked: new Date(),
          error: errorMessage
        };
        this.driftCache.set(workspace, errorResult);
        return errorResult;
      }
    } catch (error: any) {
      let errorMessage = 'Failed to check drift';
      if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Drift check timed out - Terraform plan took too long';
      } else if (error.stderr) {
        errorMessage = `Drift check failed: ${error.stderr}`;
      } else if (error.message) {
        errorMessage = `Drift check failed: ${error.message}`;
      }
      const errorResult: DriftResult = {
        workspace,
        hasDrift: false,
        changes: { add: 0, change: 0, destroy: 0 },
        details: errorMessage,
        lastChecked: new Date(),
        error: errorMessage
      };
      this.driftCache.set(workspace, errorResult);
      return errorResult;
    }
  }

  async refreshDrift(workspace: string): Promise<DriftResult> {
    // Clear cache for this workspace
    this.driftCache.delete(workspace);
    return this.checkDrift(workspace);
  }

  private parsePlanOutput(output: string, workspace: string): DriftResult {
    const lines = output.split('\n');
    let add = 0;
    let change = 0;
    let destroy = 0;
    let hasDrift = false;

    // Look for the Plan summary line
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    for (const line of lines) {
      if (line.includes('Plan:')) {
        const cleanLine = line.replace(ansiRegex, '');
        // Handle different plan output formats
        const patterns = [
          /Plan: (\d+) to add, (\d+) to change, (\d+) to destroy\.?/,
          /Plan: (\d+) to add, (\d+) to change, (\d+) to destroy, (\d+) to replace\.?/,
          /Plan: (\d+) to add, (\d+) to change, (\d+) to destroy!/
        ];

        for (let i = 0; i < patterns.length; i++) {
          const pattern = patterns[i];
          const match = cleanLine.match(pattern);
          if (match) {
            add = parseInt(match[1]) || 0;
            change = parseInt(match[2]) || 0;
            destroy = parseInt(match[3]) || 0;
            hasDrift = add > 0 || change > 0 || destroy > 0;
            break;
          }
        }
      }
    }

    // If no plan line found, check for "No changes" message
    if (add === 0 && change === 0 && destroy === 0) {
      for (const line of lines) {
        if (line.includes('No changes') || line.includes('No differences')) {
          hasDrift = false;
          break;
        }
      }
    }

    const result = {
      workspace,
      hasDrift,
      changes: { add, change, destroy },
      details: this.generateDriftSummary(add, change, destroy),
      lastChecked: new Date()
    };
    return result;
  }

  private generateDriftSummary(add: number, change: number, destroy: number): string {
    const parts: string[] = [];
    
    if (add > 0) {
      parts.push(`${add} to add`);
    }
    if (change > 0) {
      parts.push(`${change} to change`);
    }
    if (destroy > 0) {
      parts.push(`${destroy} to destroy`);
    }

    if (parts.length === 0) {
      return 'No changes. Infrastructure is up-to-date.';
    }

    return `Plan: ${parts.join(', ')}`;
  }

  getCachedDrift(workspace: string): DriftResult | undefined {
    return this.driftCache.get(workspace);
  }

  clearCache(): void {
    this.driftCache.clear();
  }
} 