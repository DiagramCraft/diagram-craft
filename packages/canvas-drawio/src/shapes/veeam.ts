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
    new DrawioShapeNodeDefinition(`mxgraph.veeam2.${toTypeName(name)}`, name, stencil)
  );
};

export const registerVeeamShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/veeam/veeam2.xml',
    'black',
    'white'
  );

  registerStencil(r, 'Veeam Logo', stencils);

  registerStencil(r, 'Datacenter', stencils);
  registerStencil(r, 'Cloud', stencils);
  registerStencil(r, 'Azure', stencils);
  registerStencil(r, 'Aws', stencils);
  registerStencil(r, 'Server', stencils);
  registerStencil(r, 'Server Cluster', stencils);
  registerStencil(r, '1u Server', stencils);
  registerStencil(r, 'Server Stack', stencils);
  registerStencil(r, 'Monitor', stencils);
  registerStencil(r, 'Laptop', stencils);
  registerStencil(r, 'Workstation', stencils);
  registerStencil(r, 'Virtual Host', stencils);
  registerStencil(r, 'ESXI Host', stencils);
  registerStencil(r, 'Hyper V Host', stencils);
  registerStencil(r, 'AHV Host', stencils);
  registerStencil(r, 'ESXI Hyper V AHV Host', stencils);
  registerStencil(r, 'ESXI Hyper V Host', stencils);
  registerStencil(r, 'Cpu', stencils);
  registerStencil(r, 'Cpu Socket', stencils);
  registerStencil(r, 'Ram', stencils);
  registerStencil(r, 'HDD', stencils);
  registerStencil(r, 'Network Card', stencils);
  registerStencil(r, 'Hardware Controller', stencils);
  registerStencil(r, 'Physical Switch', stencils);
  registerStencil(r, 'VMWare VSwitch', stencils);
  registerStencil(r, 'USB Drive', stencils);
  registerStencil(r, 'VM Checked', stencils);
  registerStencil(r, 'VM Running', stencils);
  registerStencil(r, 'SD Card', stencils);
  registerStencil(r, 'VM Failed', stencils);
  registerStencil(r, 'Linux VM', stencils);
  registerStencil(r, 'Virtual Machine', stencils);
  registerStencil(r, 'VM Snapshot', stencils);
  registerStencil(r, 'VM With A Snapshot', stencils);
  registerStencil(r, 'VM Turn On Off', stencils);
  registerStencil(r, 'VM Paused Saved State', stencils);
  registerStencil(r, 'VM Locked', stencils);
  registerStencil(r, 'Windows VM', stencils);
  registerStencil(r, 'VApp', stencils);
  registerStencil(r, 'VApp Running', stencils);

  registerStencil(r, 'Backup From Storage Snapshots', stencils);
  registerStencil(r, 'CDP', stencils);
  registerStencil(r, 'Datalabs', stencils);
  registerStencil(r, 'Failover', stencils);
  registerStencil(r, 'Instant VM Recovery', stencils);
  registerStencil(r, 'Scale Out Backup Repository2', stencils);
  registerStencil(r, 'Veeam Cloud Connect', stencils);
  registerStencil(r, 'NAS Backup', stencils);
  registerStencil(r, 'Object Storage Support', stencils);
  registerStencil(r, 'On Demand Sandbox', stencils);
  registerStencil(r, 'Restful API', stencils);
  registerStencil(r, 'Scheduled Backups', stencils);
  registerStencil(r, 'SureBackup', stencils);
  registerStencil(r, 'SureReplica', stencils);
  registerStencil(r, 'VBR Console', stencils);
  registerStencil(r, 'Veeam Cloud Mobility', stencils);
  registerStencil(r, 'VeeamZip', stencils);
  registerStencil(r, 'Veeam Explorers', stencils);
  registerStencil(r, 'Universal Storage API', stencils);

  registerStencil(r, 'Enterprise Business', stencils);
  registerStencil(r, 'SMB Business', stencils);
  registerStencil(r, 'Automation', stencils);
  registerStencil(r, 'Service Application', stencils);
  registerStencil(r, 'Database', stencils);
  registerStencil(r, 'Report', stencils);
  registerStencil(r, 'Task List', stencils);
  registerStencil(r, 'Dr Plan', stencils);
  registerStencil(r, 'Folder', stencils);
  registerStencil(r, 'File', stencils);
  registerStencil(r, 'Audio File', stencils);
  registerStencil(r, 'Data File', stencils);
  registerStencil(r, 'ISO File', stencils);
  registerStencil(r, 'Metadata File', stencils);
  registerStencil(r, 'License File', stencils);
  registerStencil(r, 'Video File', stencils);
  registerStencil(r, 'Alarm', stencils);
  registerStencil(r, 'Backup Browser', stencils);
  registerStencil(r, 'Calendar', stencils);
  registerStencil(r, 'Command Line', stencils);
  registerStencil(r, 'DNS', stencils);
  registerStencil(r, 'Exchange Objects', stencils);
  registerStencil(r, 'Monitoring Console', stencils);
  registerStencil(r, 'Tag', stencils);
  registerStencil(r, 'CD', stencils);
  registerStencil(r, 'Globe', stencils);
  registerStencil(r, 'Magnifying Glass', stencils);
  registerStencil(r, 'Web Console', stencils);
  registerStencil(r, 'Transport', stencils);
  registerStencil(r, 'Controller', stencils);
  registerStencil(r, 'Key', stencils);
  registerStencil(r, 'Restore', stencils);
  registerStencil(r, 'File Browser', stencils);
  registerStencil(r, 'VPN', stencils);
  registerStencil(r, 'Deduplication', stencils);
  registerStencil(r, 'Encryption Key', stencils);
  registerStencil(r, 'Role', stencils);
  registerStencil(r, 'Table', stencils);
  registerStencil(r, 'User', stencils);
  registerStencil(r, 'Download', stencils);
  registerStencil(r, 'Letter', stencils);
  registerStencil(r, 'Interface Console', stencils);
  registerStencil(r, 'Time Clocks', stencils);
  registerStencil(r, 'User Group', stencils);

  registerStencil(r, 'Veeam Availability Suite', stencils);
  registerStencil(r, 'Vas Server', stencils);
  registerStencil(r, 'Veeam Backup Replication', stencils);
  registerStencil(r, 'VBR Server', stencils);
  registerStencil(r, 'Proxy Server', stencils);
  registerStencil(r, 'Repository Server', stencils);
  registerStencil(r, 'Mount Server', stencils);
  registerStencil(r, 'Tape Server', stencils);
  registerStencil(r, 'Veeam Backup Enterprise Manager', stencils);
  registerStencil(r, 'VBEM Server', stencils);
  registerStencil(r, 'Search Server', stencils);
  registerStencil(r, 'Veeam One', stencils);
  registerStencil(r, 'One Server', stencils);
  registerStencil(r, 'Veeam One Reporter', stencils);
  registerStencil(r, 'Veeam Agents', stencils);
  registerStencil(r, 'Server With Veeam Agent', stencils);
  registerStencil(r, 'Veeam Agent For Windows', stencils);
  registerStencil(r, 'Veeam Agent For Linux', stencils);
  registerStencil(r, 'Veeam Agent For Oracle Solaris', stencils);
  registerStencil(r, 'Veeam Agent For IBM AIX', stencils);
  registerStencil(r, 'Veeam Explorer For Exchange', stencils);
  registerStencil(r, 'Veeam Explorer For Active Directory', stencils);
  registerStencil(r, 'Veeam Explorer For Oracle', stencils);
  registerStencil(r, 'Veeam Explorer For Onedrive', stencils);
  registerStencil(r, 'Veeam Explorer For Storage Snapshots', stencils);
  registerStencil(r, 'Veeam Explorer For SQL', stencils);
  registerStencil(r, 'Veeam Explorer For Sharepoint', stencils);
  registerStencil(r, 'Veeam Plugin For Oracle RMan', stencils);
  registerStencil(r, 'Veeam Plugin For SAP Hana', stencils);
  registerStencil(r, 'Veeam Plugin For SAP On Oracle', stencils);
  registerStencil(r, 'Veeam Backup For Office 365', stencils);
  registerStencil(r, 'VBO Server', stencils);
  registerStencil(r, 'Veeam MP', stencils);
  registerStencil(r, 'Veeam PN', stencils);
  registerStencil(r, 'VPN Server', stencils);
  registerStencil(r, 'Veeam Availability Orchestrator', stencils);
  registerStencil(r, 'VAO Server', stencils);
  registerStencil(r, 'Veeam Service Provider Console', stencils);
  registerStencil(r, 'VSPC Server', stencils);
  registerStencil(r, 'Agent', stencils);
  registerStencil(r, 'Transport Service', stencils);
  registerStencil(r, 'Data Mover', stencils);
  registerStencil(r, 'Veeam Proxy', stencils);
  registerStencil(r, 'WAN Accelerator', stencils);
  registerStencil(r, 'FLR Helper Appliance', stencils);
  registerStencil(r, 'Network Proxy', stencils);
  registerStencil(r, 'Veeam Repository', stencils);
  registerStencil(r, 'Windows Repository', stencils);
  registerStencil(r, 'Linux Repository', stencils);
  registerStencil(r, 'Cloud Repository', stencils);
  registerStencil(r, 'Scale Out Backup Repository', stencils);
  registerStencil(r, 'VBO Repository', stencils);
  registerStencil(r, 'VBR Repository', stencils);

  registerStencil(r, 'Antivirus', stencils);
  registerStencil(r, 'Firewall', stencils);
  registerStencil(r, 'Application', stencils);
  registerStencil(r, 'Linux', stencils);
  registerStencil(r, 'Linux Server', stencils);
  registerStencil(r, 'Microsoft Active Directory', stencils);
  registerStencil(r, 'Domain Controller', stencils);
  registerStencil(r, 'Microsoft Exchange', stencils);
  registerStencil(r, 'Exchange Server', stencils);
  registerStencil(r, 'Microsoft SCOM', stencils);
  registerStencil(r, 'Microsoft SCVMM', stencils);
  registerStencil(r, 'Microsoft Sharepoint', stencils);
  registerStencil(r, 'Sharepoint Server', stencils);
  registerStencil(r, 'Microsoft SQL', stencils);
  registerStencil(r, 'SQL Server', stencils);
  registerStencil(r, 'Microsoft Teams', stencils);
  registerStencil(r, 'Microsoft Windows', stencils);
  registerStencil(r, 'Windows Server', stencils);
  registerStencil(r, 'Microsoft Onedrive', stencils);
  registerStencil(r, 'Microsoft Outlook', stencils);
  registerStencil(r, 'Microsoft Office', stencils);
  registerStencil(r, 'Nutanix', stencils);
  registerStencil(r, 'VCenter Server', stencils);
  registerStencil(r, 'SAP Hana DB', stencils);
  registerStencil(r, 'Power Shell', stencils);
  registerStencil(r, 'Oracle RMan', stencils);
  registerStencil(r, 'SAP BrTools', stencils);
  registerStencil(r, 'SAP Hana', stencils);
  registerStencil(r, 'Server Nutanix', stencils);
  registerStencil(r, 'VMWare VCloud Director', stencils);
  registerStencil(r, 'VCloud Director Server', stencils);
  registerStencil(r, 'VMWare vSphere', stencils);
  registerStencil(r, 'Database2', stencils);
  registerStencil(r, 'Database Server', stencils);
  registerStencil(r, 'Microsoft SQL DB', stencils);
  registerStencil(r, 'Oracle DB', stencils);
  registerStencil(r, 'Open VPN', stencils);
  registerStencil(r, 'Wireguard', stencils);

  registerStencil(r, 'Turn On Off', stencils);
  registerStencil(r, 'Running Playing', stencils);
  registerStencil(r, 'Critical', stencils);
  registerStencil(r, 'Failed', stencils);
  registerStencil(r, 'Unavailable', stencils);
  registerStencil(r, 'Paused', stencils);
  registerStencil(r, 'Zipped', stencils);
  registerStencil(r, 'Recording', stencils);
  registerStencil(r, 'Locked', stencils);
  registerStencil(r, 'Unlocked', stencils);
  registerStencil(r, 'Encrypted', stencils);
  registerStencil(r, 'Delayed', stencils);
  registerStencil(r, 'Restored', stencils);
  registerStencil(r, 'Exported', stencils);
  registerStencil(r, 'Ejected', stencils);
  registerStencil(r, 'Instant', stencils);

  registerStencil(r, 'Object Storage', stencils);
  registerStencil(r, 'Azure Blob', stencils);
  registerStencil(r, 'AWS S3', stencils);
  registerStencil(r, 'IBM Object Storage', stencils);
  registerStencil(r, 'S3 Compatible', stencils);
  registerStencil(r, 'VMWare VSAN', stencils);
  registerStencil(r, 'NAS', stencils);
  registerStencil(r, 'Shared Folder', stencils);
  registerStencil(r, 'Datastore Empty', stencils);
  registerStencil(r, 'Datastore 33 Full', stencils);
  registerStencil(r, 'Datastore 66 Full', stencils);
  registerStencil(r, 'Datastore', stencils);
  registerStencil(r, 'Storage', stencils);
  registerStencil(r, 'Storage Snapshot', stencils);
  registerStencil(r, 'Storage With Snapshot', stencils);
  registerStencil(r, 'Storage Stack', stencils);
  registerStencil(r, 'Deduplicating Storage', stencils);
  registerStencil(r, 'Data Volume', stencils);
  registerStencil(r, 'Data Volume Snapshot', stencils);
  registerStencil(r, 'Data Volume With Snapshot', stencils);
  registerStencil(r, 'Backup File', stencils);
  registerStencil(r, 'Veeam Full Backup', stencils);
  registerStencil(r, 'Veeam Incremental Backup', stencils);
  registerStencil(r, 'Veeam Reversed Incremental Backup', stencils);
  registerStencil(r, 'Veeam Backup Chain Metadata', stencils);
  registerStencil(r, 'VBR Configuration Backup', stencils);
  registerStencil(r, 'VBR Transaction Log Backup', stencils);
  registerStencil(r, 'Tape', stencils);
  registerStencil(r, 'Tape Checkout', stencils);
  registerStencil(r, 'Tape Encrypted', stencils);
  registerStencil(r, 'Tape Locked', stencils);
  registerStencil(r, 'Tape Recording', stencils);
  registerStencil(r, 'Tape Media Pool', stencils);
  registerStencil(r, 'Tape Library', stencils);
  registerStencil(r, 'Tape Writing Device', stencils);
};
