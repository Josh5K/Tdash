import { TerraformAnalyzer } from '../analyzer/terraform-analyzer';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { StateDriftDetector } from '../drift/state-drift-detector';

export async function generateStaticDashboard(terraformPath: string): Promise<string> {
  const analyzer = new TerraformAnalyzer(terraformPath);
  const workspaceManager = new WorkspaceManager(terraformPath);
  const driftDetector = new StateDriftDetector(terraformPath);

  const [providers, modules, resources, workspaces] = await Promise.all([
    analyzer.getProviders(),
    analyzer.getModules(),
    analyzer.getResources(),
    workspaceManager.getWorkspaces()
  ]);

  const driftResults = await Promise.all(
    workspaces.map(async workspace => {
      try {
        return await driftDetector.checkDrift(workspace.name);
      } catch (error) {
        return {
          workspace: workspace.name,
          hasDrift: false,
          changes: { add: 0, change: 0, destroy: 0 },
          details: 'Failed to check drift',
          lastChecked: new Date(),
          error: 'Failed to check drift'
        };
      }
    })
  );

  return generateHTML(providers, modules, resources, workspaces, driftResults);
}

function generateHTML(
  providers: any[],
  modules: any[],
  resources: any[],
  workspaces: any[],
  driftResults: any[]
): string {
  const timestamp = new Date().toLocaleString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TDash - Terraform Dashboard</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .header h1 {
            color: #4a5568;
            font-size: 2.5rem;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .header .subtitle {
            color: #718096;
            font-size: 1.1rem;
        }

        .timestamp {
            color: #a0aec0;
            font-size: 0.9rem;
            margin-top: 10px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }

        .stat-card h3 {
            color: #4a5568;
            font-size: 1.2rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }

        .content-tabs {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .tab-nav {
            display: flex;
            background: #f7fafc;
            border-bottom: 1px solid #e2e8f0;
        }

        .tab-button {
            flex: 1;
            padding: 15px 20px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            color: #718096;
            transition: all 0.3s ease;
            border-bottom: 3px solid transparent;
        }

        .tab-button.active {
            color: #667eea;
            border-bottom-color: #667eea;
            background: white;
        }

        .tab-button:hover {
            background: #edf2f7;
        }

        .tab-content {
            display: none;
            padding: 30px;
        }

        .tab-content.active {
            display: block;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        .data-table th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
        }

        .data-table tr:hover {
            background: #f7fafc;
        }

        .workspace-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            transition: all 0.3s ease;
        }

        .workspace-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .workspace-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .workspace-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: #4a5568;
        }

        .workspace-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .status-active {
            background: #c6f6d5;
            color: #22543d;
        }

        .status-inactive {
            background: #fed7d7;
            color: #742a2a;
        }

        .drift-info {
            display: flex;
            gap: 15px;
            margin-top: 10px;
            align-items: center;
        }

        .drift-badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .drift-add {
            background: #c6f6d5;
            color: #22543d;
        }

        .drift-change {
            background: #fef5e7;
            color: #744210;
        }

        .drift-destroy {
            background: #fed7d7;
            color: #742a2a;
        }

        .drift-none {
            background: #e2e8f0;
            color: #4a5568;
        }

        .error-message {
            background: #fed7d7;
            color: #742a2a;
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
        }

        .json-config {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            max-height: 200px;
            overflow-y: auto;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
            
            .tab-nav {
                flex-direction: column;
            }
            
            .data-table {
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-cube"></i>
                TDash
            </h1>
            <div class="subtitle">Terraform/OpenTofu Repository Dashboard</div>
            <div class="timestamp">Generated on: ${timestamp}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3><i class="fas fa-plug"></i> Providers</h3>
                <div class="stat-number">${providers.length}</div>
                <div>Configured providers</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-puzzle-piece"></i> Modules</h3>
                <div class="stat-number">${modules.length}</div>
                <div>Used modules</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-server"></i> Resources</h3>
                <div class="stat-number">${resources.length}</div>
                <div>Defined resources</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-layer-group"></i> Workspaces</h3>
                <div class="stat-number">${workspaces.length}</div>
                <div>Available workspaces</div>
            </div>
        </div>

        <div class="content-tabs">
            <div class="tab-nav">
                <button class="tab-button active" onclick="switchTab('providers')">
                    <i class="fas fa-plug"></i> Providers
                </button>
                <button class="tab-button" onclick="switchTab('modules')">
                    <i class="fas fa-puzzle-piece"></i> Modules
                </button>
                <button class="tab-button" onclick="switchTab('resources')">
                    <i class="fas fa-server"></i> Resources
                </button>
                <button class="tab-button" onclick="switchTab('workspaces')">
                    <i class="fas fa-layer-group"></i> Workspaces
                </button>
            </div>

            <div class="tab-content active" id="providers-tab">
                ${generateProvidersTable(providers)}
            </div>

            <div class="tab-content" id="modules-tab">
                ${generateModulesTable(modules)}
            </div>

            <div class="tab-content" id="resources-tab">
                ${generateResourcesTable(resources)}
            </div>

            <div class="tab-content" id="workspaces-tab">
                ${generateWorkspacesTable(workspaces, driftResults)}
            </div>
        </div>
    </div>

    <script>
        function switchTab(tabName) {
            // Update active tab button
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');

            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName + '-tab').classList.add('active');
        }
    </script>
</body>
</html>`;
}

function generateProvidersTable(providers: any[]): string {
  if (providers.length === 0) {
    return '<div style="text-align: center; padding: 40px; color: #718096;">No providers found</div>';
  }

  const rows = providers.map(provider => `
    <tr>
      <td><strong>${provider.name}</strong></td>
      <td>${provider.version || 'latest'}</td>
      <td>${provider.source || 'registry.terraform.io'}</td>
      <td><div class="json-config">${JSON.stringify(provider.configuration, null, 2)}</div></td>
    </tr>
  `).join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Version</th>
          <th>Source</th>
          <th>Configuration</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateModulesTable(modules: any[]): string {
  if (modules.length === 0) {
    return '<div style="text-align: center; padding: 40px; color: #718096;">No modules found</div>';
  }

  const rows = modules.map(module => `
    <tr>
      <td><strong>${module.name}</strong></td>
      <td>${module.source}</td>
      <td>${module.version || 'latest'}</td>
      <td><div class="json-config">${JSON.stringify(module.configuration, null, 2)}</div></td>
    </tr>
  `).join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Source</th>
          <th>Version</th>
          <th>Configuration</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateResourcesTable(resources: any[]): string {
  if (resources.length === 0) {
    return '<div style="text-align: center; padding: 40px; color: #718096;">No resources found</div>';
  }

  const rows = resources.map(resource => `
    <tr>
      <td><strong>${resource.name}</strong></td>
      <td><code>${resource.type}</code></td>
      <td>${resource.provider}</td>
      <td>${resource.dependencies.length > 0 ? resource.dependencies.join(', ') : 'None'}</td>
    </tr>
  `).join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Provider</th>
          <th>Dependencies</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateWorkspacesTable(workspaces: any[], driftResults: any[]): string {
  if (workspaces.length === 0) {
    return '<div style="text-align: center; padding: 40px; color: #718096;">No workspaces found</div>';
  }

  const workspaceCards = workspaces.map(workspace => {
    const drift = driftResults.find(d => d.workspace === workspace.name) || {
      hasDrift: false,
      changes: { add: 0, change: 0, destroy: 0 },
      details: 'No drift information available',
      error: true
    };
    
    const driftBadges = [];
    if (drift.changes.add > 0) {
      driftBadges.push(`<span class="drift-badge drift-add">+${drift.changes.add}</span>`);
    }
    if (drift.changes.change > 0) {
      driftBadges.push(`<span class="drift-badge drift-change">~${drift.changes.change}</span>`);
    }
    if (drift.changes.destroy > 0) {
      driftBadges.push(`<span class="drift-badge drift-destroy">-${drift.changes.destroy}</span>`);
    }
    if (driftBadges.length === 0) {
      driftBadges.push(`<span class="drift-badge drift-none">No changes</span>`);
    }

    const errorMessage = drift.error ? `<div class="error-message">${drift.details}</div>` : '';

    return `
      <div class="workspace-card">
        <div class="workspace-header">
          <div class="workspace-name">${workspace.name}</div>
        </div>
        <div class="drift-info">
          <div>${drift.details}</div>
          <div>${driftBadges.join('')}</div>
        </div>
        ${errorMessage}
      </div>
    `;
  }).join('');

  return workspaceCards;
} 