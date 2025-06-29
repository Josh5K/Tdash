#!/usr/bin/env node

import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generate';
import { version } from '../package.json';

const program = new Command();

program
  .name('tdash')
  .description('A CLI tool to visualize Terraform/OpenTofu repository statistics')
  .version(version);

// Register commands
registerGenerateCommand(program);

program.parse(); 