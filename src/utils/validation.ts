import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export async function validateTerraformPath(path: string): Promise<string> {
  const absolutePath = require('path').resolve(path);
  
  if (!existsSync(absolutePath)) {
    throw new Error(`Path does not exist: ${path}`);
  }
  
  // Check if it's a directory
  const stats = require('fs').statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${path}`);
  }
  
  // Look for Terraform/OpenTofu files
  const files = readdirSync(absolutePath);
  const terraformFiles = files.filter(file => 
    file.endsWith('.tf') || 
    file.endsWith('.tfvars') || 
    file.endsWith('.hcl') ||
    file === 'terraform.tfstate' ||
    file === '.terraform'
  );
  
  if (terraformFiles.length === 0) {
    throw new Error(`No Terraform/OpenTofu files found in: ${path}`);
  }
  
  return absolutePath;
} 