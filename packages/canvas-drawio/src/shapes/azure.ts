import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioShapeNodeDefinition } from '../node-types/DrawioShape.nodeType';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<DrawioStencil>
) => {
  const stencil = findStencilByName(stencils, name);

  registry.register(
    new DrawioShapeNodeDefinition(`mxgraph.azure.${toTypeName(name)}`, name, stencil)
  );
};

export const registerAzureShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/azure.xml',
    'Azure',
    '#00BEF2',
    'white'
  );

  registerStencil(r, 'Access Control', stencils);
  registerStencil(r, 'Automation', stencils);
  registerStencil(r, 'AutoScale', stencils);
  registerStencil(r, 'Azure Active Directory', stencils);
  registerStencil(r, 'Azure Alert', stencils);

  registerStencil(r, 'Azure Cache', stencils);
  registerStencil(r, 'Azure Instance', stencils);
  registerStencil(r, 'Azure Load Balancer', stencils);
  registerStencil(r, 'Azure Marketplace', stencils);
  registerStencil(r, 'Azure SDK', stencils);

  registerStencil(r, 'Azure Subscription', stencils);
  registerStencil(r, 'Azure Website', stencils);
  registerStencil(r, 'Backup Service', stencils);
  registerStencil(r, 'BitBucket Code Source', stencils);
  registerStencil(r, 'BizTalk Services', stencils);

  registerStencil(r, 'Certificate', stencils);
  registerStencil(r, 'Cloud', stencils);
  registerStencil(r, 'Cloud Service', stencils);
  registerStencil(r, 'Cloud Services Configuration File', stencils);
  registerStencil(r, 'Cloud Service Package File', stencils);

  registerStencil(r, 'CodePlex Code Source', stencils);
  registerStencil(r, 'Code File', stencils);
  registerStencil(r, 'Computer', stencils);
  registerStencil(r, 'Content Delivery Network', stencils);
  registerStencil(r, 'Database', stencils);

  registerStencil(r, 'DropBox Code Source', stencils);
  registerStencil(r, 'Enterprise', stencils);
  registerStencil(r, 'Express Route', stencils);
  registerStencil(r, 'File', stencils);
  registerStencil(r, 'File 2', stencils);

  registerStencil(r, 'GitHub Code', stencils);
  registerStencil(r, 'Git Repository', stencils);
  registerStencil(r, 'HDInsight', stencils);
  registerStencil(r, 'Healthy', stencils);
  registerStencil(r, 'Health Monitoring', stencils);

  registerStencil(r, 'Hyper V Recovery Manager', stencils);
  registerStencil(r, 'Laptop', stencils);
  registerStencil(r, 'Load Balancer Generic', stencils);
  registerStencil(r, 'Media Service', stencils);
  registerStencil(r, 'Message', stencils);

  registerStencil(r, 'Mobile', stencils);
  registerStencil(r, 'Mobile Services', stencils);
  registerStencil(r, 'Multi Factor Authentication', stencils);
  registerStencil(r, 'MySQL Database', stencils);
  registerStencil(r, 'Notification Hub', stencils);

  registerStencil(r, 'Notification Topic', stencils);
  registerStencil(r, 'Operating System Image', stencils);
  registerStencil(r, 'PowerShell File', stencils);
  registerStencil(r, 'Queue Generic', stencils);
  registerStencil(r, 'RDP Remoting File', stencils);

  registerStencil(r, 'Scheduler', stencils);
  registerStencil(r, 'Script File', stencils);
  registerStencil(r, 'Server', stencils);
  registerStencil(r, 'Server Rack', stencils);
  registerStencil(r, 'Service Bus', stencils);

  registerStencil(r, 'Service Bus Queues', stencils);
  registerStencil(r, 'Service Bus Relay', stencils);
  registerStencil(r, 'Service Bus Topics And Subscriptions', stencils);
  registerStencil(r, 'Service Endpoint', stencils);
  registerStencil(r, 'SQL Database', stencils);

  registerStencil(r, 'SQL Database SQL Azure', stencils);
  registerStencil(r, 'SQL Datasync', stencils);
  registerStencil(r, 'SQL Reporting', stencils);
  registerStencil(r, 'Startup Task', stencils);
  registerStencil(r, 'Storage', stencils);

  registerStencil(r, 'Storage Blob', stencils);
  registerStencil(r, 'Storage Queue', stencils);
  registerStencil(r, 'Storage Table', stencils);
  registerStencil(r, 'Storsimple', stencils);
  registerStencil(r, 'Tablet', stencils);

  registerStencil(r, 'Team Foundation Service', stencils);
  registerStencil(r, 'Traffic Manager', stencils);
  registerStencil(r, 'Unidentified Code Object', stencils);
  registerStencil(r, 'User', stencils);
  registerStencil(r, 'VHD', stencils);

  registerStencil(r, 'VHD Data Disk', stencils);
  registerStencil(r, 'Virtual Machine', stencils);
  registerStencil(r, 'Virtual Machine Feature', stencils);
  registerStencil(r, 'Virtual Network', stencils);
  registerStencil(r, 'Visual Studio Online', stencils);

  registerStencil(r, 'WADCFG Diagnostics File', stencils);
  registerStencil(r, 'Website Generic', stencils);
  registerStencil(r, 'Web Role', stencils);
  registerStencil(r, 'Web Roles', stencils);
  registerStencil(r, 'Worker Role', stencils);

  registerStencil(r, 'Worker Roles', stencils);
};
