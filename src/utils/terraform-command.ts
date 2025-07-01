import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TerraformCommand {
  command: string;
  type: 'terraform' | 'opentofu';
  version?: string;
}

let cachedCommand: TerraformCommand | null = null;

/**
 * Detects and returns the appropriate Terraform/OpenTofu command to use
 * Priority: OpenTofu (tofu) > Terraform (terraform)
 */
export async function getTerraformCommand(): Promise<TerraformCommand> {
  if (cachedCommand) {
    return cachedCommand;
  }

  try {
    // First try OpenTofu (tofu)
    const { stdout: tofuVersion } = await execAsync('tofu version', { timeout: 5000 });
    const versionMatch = tofuVersion.match(/OpenTofu v([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : undefined;
    
    cachedCommand = {
      command: 'tofu',
      type: 'opentofu',
      version
    };
    
    console.log(`Using OpenTofu (tofu) version: ${version || 'unknown'}`);
    return cachedCommand;
  } catch (error) {
    // If OpenTofu is not available, try Terraform
    try {
      const { stdout: terraformVersion } = await execAsync('terraform version', { timeout: 5000 });
      const versionMatch = terraformVersion.match(/Terraform v([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : undefined;
      
      cachedCommand = {
        command: 'terraform',
        type: 'terraform',
        version
      };
      
      console.log(`Using Terraform version: ${version || 'unknown'}`);
      return cachedCommand;
    } catch (terraformError) {
      // If neither is available, default to terraform and let the calling code handle the error
      console.warn('Neither OpenTofu (tofu) nor Terraform found, defaulting to terraform command');
      cachedCommand = {
        command: 'terraform',
        type: 'terraform'
      };
      return cachedCommand;
    }
  }
}

/**
 * Clears the cached command, forcing re-detection on next call
 */
export function clearTerraformCommandCache(): void {
  cachedCommand = null;
}

/**
 * Gets the command string directly (synchronous wrapper)
 * Note: This will use cached value if available, otherwise defaults to 'terraform'
 */
export function getTerraformCommandSync(): string {
  return cachedCommand?.command || 'terraform';
} 