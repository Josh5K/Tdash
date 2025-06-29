import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Workspace {
  name: string;
  isCurrent: boolean;
  state: 'active' | 'inactive';
}

export class WorkspaceManager {
  private terraformPath: string;

  constructor(terraformPath: string) {
    this.terraformPath = terraformPath;
  }

  async getWorkspaces(): Promise<Workspace[]> {
    try {
      const { stdout } = await execAsync('terraform workspace list', {
        cwd: this.terraformPath
      });

      const lines = stdout.trim().split('\n');
      const workspaces: Workspace[] = [];

      for (const line of lines) {
        if (line.trim()) {
          const isCurrent = line.startsWith('*');
          const name = line.replace('*', '').trim();
          
          workspaces.push({
            name,
            isCurrent,
            state: isCurrent ? 'active' : 'inactive'
          });
        }
      }

      return workspaces;
    } catch (error) {
      console.warn('Failed to get workspaces:', error);
      return [];
    }
  }

  async getCurrentWorkspace(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('terraform workspace show', {
        cwd: this.terraformPath
      });
      return stdout.trim();
    } catch (error) {
      console.warn('Failed to get current workspace:', error);
      return null;
    }
  }

  async switchWorkspace(name: string): Promise<boolean> {
    try {
      await execAsync(`terraform workspace select ${name}`, {
        cwd: this.terraformPath
      });
      return true;
    } catch (error) {
      console.warn(`Failed to switch to workspace ${name}:`, error);
      return false;
    }
  }

  async createWorkspace(name: string): Promise<boolean> {
    try {
      await execAsync(`terraform workspace new ${name}`, {
        cwd: this.terraformPath
      });
      return true;
    } catch (error) {
      console.warn(`Failed to create workspace ${name}:`, error);
      return false;
    }
  }
} 