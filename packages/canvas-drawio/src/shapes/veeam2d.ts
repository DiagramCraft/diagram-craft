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
    new DrawioShapeNodeDefinition(`mxgraph.veeam.2d.${toTypeName(name)}`, name, stencil)
  );
};

export const registerVeeam2dShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils('/stencils/veeam/2d.xml', 'Veeam', 'black', 'white');

  registerStencil(r, '1FTVM', stencils);
  registerStencil(r, '1FTVM Error', stencils);
  registerStencil(r, '1FTVM Running', stencils);
  registerStencil(r, '1FTVM Unavailable', stencils);
  registerStencil(r, '1FTVM Warning', stencils);
  registerStencil(r, '1 Click Failover Orchestration', stencils);
  registerStencil(r, '2FTVM', stencils);
  registerStencil(r, '2FTVM Error', stencils);
  registerStencil(r, '2FTVM Running', stencils);
  registerStencil(r, '2FTVM Unavailable', stencils);
  registerStencil(r, '2FTVM Warning', stencils);
  registerStencil(r, 'Agent', stencils);
  registerStencil(r, 'Alarm', stencils);
  registerStencil(r, 'Alert', stencils);
  registerStencil(r, 'Assisted Failover and Failback', stencils);
  registerStencil(r, 'Backup Browser', stencils);
  registerStencil(r, 'Backup from Storage Snapshots', stencils);
  registerStencil(r, 'Backup Repository', stencils);
  registerStencil(r, 'Backup Repository 2', stencils);
  registerStencil(r, 'Built in WAN Acceleration', stencils);
  registerStencil(r, 'CD', stencils);
  registerStencil(r, 'Cloud', stencils);
  registerStencil(r, 'Cloud Gateway', stencils);
  registerStencil(r, 'Database', stencils);
  registerStencil(r, 'Datastore', stencils);
  registerStencil(r, 'Datastore Snapshot', stencils);
  registerStencil(r, 'Datastore Volume', stencils);
  registerStencil(r, 'Data Mover', stencils);
  registerStencil(r, 'Disaster Recovery', stencils);
  registerStencil(r, 'Download', stencils);
  registerStencil(r, 'EMC Data Domain Boost', stencils);
  registerStencil(r, 'Encryption Object', stencils);
  registerStencil(r, 'End to end Encryption', stencils);
  registerStencil(r, 'ESX ESXi', stencils);
  registerStencil(r, 'ExaGrid', stencils);
  registerStencil(r, 'Failover Protective Snapshot', stencils);
  registerStencil(r, 'Failover Protective Snapshot Locked', stencils);
  registerStencil(r, 'Failover Protective Snapshot Running', stencils);
  registerStencil(r, 'File', stencils);
  registerStencil(r, 'File System Browser', stencils);
  registerStencil(r, 'Folder', stencils);
  registerStencil(r, 'Forward Incremental Backup Increment', stencils);
  registerStencil(r, 'Free Datastore', stencils);
  registerStencil(r, 'Full Datastore', stencils);
  registerStencil(r, 'Full Veeam Backup', stencils);
  registerStencil(r, 'Group', stencils);
  registerStencil(r, 'Hard Drive', stencils);
  registerStencil(r, 'HP StoreOnce', stencils);
  registerStencil(r, 'Hyper V Host', stencils);
  registerStencil(r, 'Hyper V VMware Host', stencils);
  registerStencil(r, 'Letter', stencils);
  registerStencil(r, 'License', stencils);
  registerStencil(r, 'Lost Space', stencils);
  registerStencil(r, 'LUN', stencils);
  registerStencil(r, 'Medium Datastore', stencils);
  registerStencil(r, 'Monitoring Console', stencils);
  registerStencil(r, 'Native Tape Support', stencils);
  registerStencil(r, 'Network Card', stencils);
  registerStencil(r, 'On Demand Sandbox', stencils);
  registerStencil(r, 'Physical Storage', stencils);
  registerStencil(r, 'PowerShell Extension', stencils);
  registerStencil(r, 'Private Key', stencils);
  registerStencil(r, 'Privilege', stencils);
  registerStencil(r, 'Proxy', stencils);
  registerStencil(r, 'Proxy Appliance', stencils);
  registerStencil(r, 'Quick Migration', stencils);
  registerStencil(r, 'Remote Site', stencils);
  registerStencil(r, 'Remote Storage', stencils);
  registerStencil(r, 'Replication from a Backup', stencils);
  registerStencil(r, 'Report', stencils);
  registerStencil(r, 'Resource Pool', stencils);
  registerStencil(r, 'RESTful APIs', stencils);
  registerStencil(r, 'Restore Data from the VM Backup', stencils);
  registerStencil(r, 'Reversed Incremental Backup Increment', stencils);
  registerStencil(r, 'Role', stencils);
  registerStencil(r, 'Scheduled Backups', stencils);
  registerStencil(r, 'Search', stencils);
  registerStencil(r, 'Self Service Recovery', stencils);
  registerStencil(r, 'Service', stencils);
  registerStencil(r, 'Service Console', stencils);
  registerStencil(r, 'Service vNIC', stencils);
  registerStencil(r, 'Sure Backup', stencils);
  registerStencil(r, 'Sure Replica', stencils);
  registerStencil(r, 'Switch', stencils);
  registerStencil(r, 'Tape', stencils);
  registerStencil(r, 'Tape Checked', stencils);
  registerStencil(r, 'Tape Device', stencils);
  registerStencil(r, 'Tape Ejecting', stencils);
  registerStencil(r, 'Tape Library', stencils);
  registerStencil(r, 'Tape Licensed', stencils);
  registerStencil(r, 'Tape Recording', stencils);
  registerStencil(r, 'Tape Server', stencils);
  registerStencil(r, 'Transport Service', stencils);
  registerStencil(r, 'User', stencils);
  registerStencil(r, 'U AIR', stencils);
  registerStencil(r, 'vApp', stencils);
  registerStencil(r, 'vApp Started', stencils);
  registerStencil(r, 'VeeamZIP', stencils);
  registerStencil(r, 'Veeam Availability Suite', stencils);
  registerStencil(r, 'Veeam Backup and Replication Server', stencils);
  registerStencil(r, 'Veeam Backup Enterprise Manager Server', stencils);
  registerStencil(r, 'Veeam Backup Search Server', stencils);
  registerStencil(r, 'Veeam Backup Shell', stencils);
  registerStencil(r, 'Veeam Cloud Connect', stencils);
  registerStencil(r, 'Veeam Explorer', stencils);
  registerStencil(r, 'Veeam Explorer for Active Directory', stencils);
  registerStencil(r, 'Veeam Explorer for Exchange', stencils);
  registerStencil(r, 'Veeam Explorer for SharePoint', stencils);
  registerStencil(r, 'Veeam Explorer for SQL', stencils);
  registerStencil(r, 'Veeam Logo', stencils);
  registerStencil(r, 'Veeam ONE Business View', stencils);
  registerStencil(r, 'Veeam ONE Monitor', stencils);
  registerStencil(r, 'Veeam ONE Reporter', stencils);
  registerStencil(r, 'Veeam ONE Server', stencils);
  registerStencil(r, 'Virtual Lab', stencils);
  registerStencil(r, 'Virtual Machine', stencils);
  registerStencil(r, 'Virtual Switch', stencils);
  registerStencil(r, 'VMware Host', stencils);
  registerStencil(r, 'VM Backup', stencils);
  registerStencil(r, 'VM Failed', stencils);
  registerStencil(r, 'VM Image Full Backup', stencils);
  registerStencil(r, 'VM Image Incremental Backup', stencils);
  registerStencil(r, 'VM Linux', stencils);
  registerStencil(r, 'VM Locked', stencils);
  registerStencil(r, 'VM No Network', stencils);
  registerStencil(r, 'VM Problem', stencils);
  registerStencil(r, 'VM Running', stencils);
  registerStencil(r, 'VM Saved State', stencils);
  registerStencil(r, 'VM Windows', stencils);
  registerStencil(r, 'vNIC', stencils);
  registerStencil(r, 'vsb File', stencils);
  registerStencil(r, 'WAN Accelerator', stencils);
  registerStencil(r, 'Web Console', stencils);
  registerStencil(r, 'Web UI', stencils);
  registerStencil(r, 'Workstation', stencils);
};
