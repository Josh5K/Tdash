import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Provider {
  name: string;
  version?: string;
  source?: string;
  configuration: Record<string, any>;
}

export interface Module {
  name: string;
  source: string;
  version?: string;
  configuration: Record<string, any>;
}

export interface Resource {
  name: string;
  type: string;
  provider: string;
  configuration: Record<string, any>;
  dependencies: string[];
}

export class TerraformAnalyzer {
  private terraformPath: string;

  constructor(terraformPath: string) {
    this.terraformPath = terraformPath;
  }

  async getProviders(): Promise<Provider[]> {
    const providers: Provider[] = [];
    const tfFiles = await this.getTerraformFiles();

    for (const file of tfFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const parsed = await this.parseHcl(content);
        
        // Handle terraform.required_providers structure
        if (parsed.terraform && Array.isArray(parsed.terraform)) {
          for (const terraformBlock of parsed.terraform) {
            if (terraformBlock.required_providers && Array.isArray(terraformBlock.required_providers)) {
              for (const providerBlock of terraformBlock.required_providers) {
                for (const [name, config] of Object.entries(providerBlock)) {
                  const providerConfig = config as any;
                  providers.push({
                    name,
                    version: providerConfig.version,
                    source: providerConfig.source,
                    configuration: providerConfig
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error);
      }
    }

    return providers;
  }

  async getModules(): Promise<Module[]> {
    const modules: Module[] = [];
    const tfFiles = await this.getTerraformFiles();

    for (const file of tfFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const parsed = await this.parseHcl(content);
        
        if (parsed.module) {
          for (const [name, moduleConfigs] of Object.entries(parsed.module)) {
            if (Array.isArray(moduleConfigs)) {
              for (const moduleConfig of moduleConfigs) {
                modules.push({
                  name,
                  source: moduleConfig.source,
                  version: moduleConfig.version,
                  configuration: moduleConfig
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error);
      }
    }

    return modules;
  }

  async getResources(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const tfFiles = await this.getTerraformFiles();

    for (const file of tfFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const parsed = await this.parseHcl(content);
        
        // Extract resources
        if (parsed.resource) {
          for (const [resourceType, resourceConfigs] of Object.entries(parsed.resource)) {
            for (const [name, configs] of Object.entries(resourceConfigs as any)) {
              if (Array.isArray(configs)) {
                for (const resourceConfig of configs) {
                  resources.push({
                    name,
                    type: resourceType,
                    provider: this.extractProvider(resourceType, resourceConfig),
                    configuration: resourceConfig,
                    dependencies: this.extractDependencies(resourceConfig)
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error);
      }
    }

    return resources;
  }

  private async getTerraformFiles(): Promise<string[]> {
    const patterns = [
      join(this.terraformPath, '**/*.tf'),
      join(this.terraformPath, '**/*.tfvars'),
      join(this.terraformPath, '**/*.hcl')
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { ignore: ['**/node_modules/**', '**/.terraform/**'] });
      files.push(...matches);
    }

    return files;
  }

  private extractProvider(resourceType: string, config: any): string {
    // Try to extract provider from the resource configuration
    if (config.provider) {
      return config.provider;
    }

    // Default provider mapping based on resource type
    const providerMap: Record<string, string> = {
      'aws': 'aws',
      'azurerm': 'azurerm',
      'google': 'google',
      'kubernetes': 'kubernetes',
      'helm': 'helm',
      'docker': 'docker',
      'null': 'null',
      'local': 'local',
      'random': 'random'
    };

    for (const [provider, prefix] of Object.entries(providerMap)) {
      if (resourceType.startsWith(prefix)) {
        return provider;
      }
    }

    return 'unknown';
  }

  private extractDependencies(config: any): string[] {
    const dependencies: string[] = [];
    
    const extractFromValue = (value: any): void => {
      if (typeof value === 'string' && value.includes('${')) {
        const matches = value.match(/\$\{([^}]+)\}/g);
        if (matches) {
          for (const match of matches) {
            const ref = match.slice(2, -1); // Remove ${ and }
            if (ref.includes('.')) {
              dependencies.push(ref);
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const val of Object.values(value)) {
          extractFromValue(val);
        }
      }
    };

    extractFromValue(config);
    return [...new Set(dependencies)]; // Remove duplicates
  }

  private async parseHcl(content: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`echo '${content.replace(/'/g, "'\"'\"'")}' | hcl2json`);
      return JSON.parse(stdout);
    } catch (error) {
      console.warn('Failed to parse HCL with hcl2json, falling back to basic parsing');
      // Fallback to basic parsing for simple cases
      return this.basicHclParse(content);
    }
  }

  private basicHclParse(content: string): any {
    // Very basic HCL parsing for fallback - this is limited
    const result: any = {};
    
    // Simple provider extraction
    const providerMatch = content.match(/required_providers\s*{([^}]+)}/);
    if (providerMatch) {
      result.terraform = { required_providers: {} };
      const providerContent = providerMatch[1];
      const providerRegex = /(\w+)\s*=\s*{([^}]+)}/g;
      let match;
      while ((match = providerRegex.exec(providerContent)) !== null) {
        result.terraform.required_providers[match[1]] = {};
      }
    }

    // Simple module extraction
    const moduleRegex = /module\s+"([^"]+)"\s*{([^}]+)}/g;
    result.module = {};
    let moduleMatch;
    while ((moduleMatch = moduleRegex.exec(content)) !== null) {
      result.module[moduleMatch[1]] = {};
    }

    return result;
  }
} 