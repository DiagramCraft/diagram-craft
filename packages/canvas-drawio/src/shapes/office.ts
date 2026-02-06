import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioShapeNodeDefinition } from '../node-types/DrawioShape.nodeType';

const registerStencil = (
  reg: NodeDefinitionRegistry,
  type: string,
  name: string,
  stencils: Array<DrawioStencil>
) => {
  const stencil = findStencilByName(stencils, name);

  reg.register(
    new DrawioShapeNodeDefinition(`mxgraph.office.${type}.${toTypeName(name)}`, name, stencil)
  );
};

export const registerOfficeServersShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils('$STENCIL_ROOT/stencils/office/servers.xml', 'Azure');

  registerStencil(r, 'servers', '3rd Party Mail Server', stencils);
  registerStencil(r, 'servers', 'Active Directory Federation Services Proxy', stencils);
  registerStencil(r, 'servers', 'Active Directory Federation Services Server Blue', stencils);
  registerStencil(r, 'servers', 'Active Directory Federation Services Server Ghosted', stencils);
  registerStencil(r, 'servers', 'Active Directory Federation Services Server Green', stencils);
  registerStencil(r, 'servers', 'Active Directory Federation Services Server Orange', stencils);
  registerStencil(r, 'servers', 'Active Directory Federation Services Server', stencils);
  registerStencil(r, 'servers', 'Application Server Blue', stencils);
  registerStencil(r, 'servers', 'Application Server Ghosted', stencils);
  registerStencil(r, 'servers', 'Application Server Green', stencils);
  registerStencil(r, 'servers', 'Application Server Orange', stencils);
  registerStencil(r, 'servers', 'Application Server', stencils);
  registerStencil(r, 'servers', 'Call Admission Control Service', stencils);
  registerStencil(r, 'servers', 'Certificate Authority', stencils);
  registerStencil(r, 'servers', 'Cluster Server', stencils);
  registerStencil(r, 'servers', 'Database Server Blue', stencils);
  registerStencil(r, 'servers', 'Database Server Ghosted', stencils);
  registerStencil(r, 'servers', 'Database Server Green', stencils);
  registerStencil(r, 'servers', 'Database Server Orange', stencils);
  registerStencil(r, 'servers', 'Database Server', stencils);
  registerStencil(r, 'servers', 'Datacenter', stencils);
  registerStencil(r, 'servers', 'Dirsync Server', stencils);
  registerStencil(r, 'servers', 'Domain Controller', stencils);
  registerStencil(r, 'servers', 'Excahnge Client Access Server Role', stencils);
  registerStencil(r, 'servers', 'Exchange Client Access Server', stencils);
  registerStencil(r, 'servers', 'Exchange Edge Transport Server Role', stencils);
  registerStencil(r, 'servers', 'Exchange Edge Transport Server', stencils);
  registerStencil(r, 'servers', 'Exchange Hub Transport Server Role', stencils);
  registerStencil(r, 'servers', 'Exchange Mailbox Server Role', stencils);
  registerStencil(r, 'servers', 'Exchange Mailbox Server', stencils);
  registerStencil(r, 'servers', 'Exchange Server', stencils);
  registerStencil(r, 'servers', 'Exchange UM Server Role', stencils);
  registerStencil(r, 'servers', 'File Server', stencils);
  registerStencil(r, 'servers', 'Hybrid Server', stencils);
  registerStencil(r, 'servers', 'Mainframe Host', stencils);
  registerStencil(r, 'servers', 'Mainframe', stencils);
  registerStencil(r, 'servers', 'Monitoring SQL Reporting Services', stencils);
  registerStencil(r, 'servers', 'Network', stencils);
  registerStencil(r, 'servers', 'Office Web Apps Server', stencils);
  registerStencil(r, 'servers', 'On Premises Server', stencils);
  registerStencil(r, 'servers', 'Physical Host Farm', stencils);
  registerStencil(r, 'servers', 'Physical Host', stencils);
  registerStencil(r, 'servers', 'Reverse Proxy', stencils);
  registerStencil(r, 'servers', 'SCOM', stencils);
  registerStencil(r, 'servers', 'Server Disaster', stencils);
  registerStencil(r, 'servers', 'Server Generic', stencils);
  registerStencil(r, 'servers', 'Server Side Code', stencils);
  registerStencil(r, 'servers', 'Sharepoint Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Back End Server Mirror', stencils);
  registerStencil(r, 'servers', 'Skype For Business Back End Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Director Array', stencils);
  registerStencil(r, 'servers', 'Skype For Business Director', stencils);
  registerStencil(r, 'servers', 'Skype For Business Edge Server Pool', stencils);
  registerStencil(r, 'servers', 'Skype For Business Edge Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Front End Pool', stencils);
  registerStencil(r, 'servers', 'Skype For Business Front End Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Mediation Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Monitoring Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Persistent Chat Server', stencils);
  registerStencil(r, 'servers', 'Skype For Business Server', stencils);
  registerStencil(r, 'servers', 'Trusted Application Server', stencils);
  registerStencil(r, 'servers', 'Tunnel Angled', stencils);
  registerStencil(r, 'servers', 'Tunnel Straight', stencils);
  registerStencil(r, 'servers', 'Universal Security Group', stencils);
  registerStencil(r, 'servers', 'Video Interop Server', stencils);
  registerStencil(r, 'servers', 'Virtual Application Server', stencils);
  registerStencil(r, 'servers', 'Virtual Database Server', stencils);
  registerStencil(r, 'servers', 'Virtual Server', stencils);
  registerStencil(r, 'servers', 'Virtual Web Server', stencils);
  registerStencil(r, 'servers', 'Vociemail Preview Partner', stencils);
  registerStencil(r, 'servers', 'Web Server Blue', stencils);
  registerStencil(r, 'servers', 'Web Server Ghosted', stencils);
  registerStencil(r, 'servers', 'Web Server Green', stencils);
  registerStencil(r, 'servers', 'Web Server Orange', stencils);
  registerStencil(r, 'servers', 'Web Server', stencils);
  registerStencil(r, 'servers', 'Windows Router', stencils);
  registerStencil(r, 'servers', 'Windows Server', stencils);
};

export const registerOfficeSecurityShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/security.xml',
    'black',
    'white'
  );

  registerStencil(r, 'security', 'Active Directory', stencils);
  registerStencil(r, 'security', 'Address Book Policies', stencils);
  registerStencil(r, 'security', 'Certificate', stencils);
  registerStencil(r, 'security', 'Credentials', stencils);
  registerStencil(r, 'security', 'Domain', stencils);
  registerStencil(r, 'security', 'Email Address Policy', stencils);
  registerStencil(r, 'security', 'Federation Service', stencils);
  registerStencil(r, 'security', 'Federation Trust', stencils);
  registerStencil(r, 'security', 'IRM Protected Message', stencils);
  registerStencil(r, 'security', 'Key Permissions', stencils);
  registerStencil(r, 'security', 'Lock Protected', stencils);
  registerStencil(r, 'security', 'Lock Unprotected', stencils);
  registerStencil(r, 'security', 'Lock Unprotected', stencils);
  registerStencil(r, 'security', 'Lock With Key Security Blue', stencils);
  registerStencil(r, 'security', 'Lock With Key Security Ghosted', stencils);
  registerStencil(r, 'security', 'Lock With Key Security Green', stencils);
  registerStencil(r, 'security', 'Lock With Key Security Orange', stencils);
  registerStencil(r, 'security', 'Lock With Key Security', stencils);
  registerStencil(r, 'security', 'Management Role', stencils);
  registerStencil(r, 'security', 'Policy', stencils);
  registerStencil(r, 'security', 'Policy', stencils);
  registerStencil(r, 'security', 'Protected Voice Mail', stencils);
  registerStencil(r, 'security', 'Retention Policy Tag', stencils);
  registerStencil(r, 'security', 'Retention Policy', stencils);
  registerStencil(r, 'security', 'Role Assignment Policy', stencils);
  registerStencil(r, 'security', 'Role Group', stencils);
  registerStencil(r, 'security', 'Secure Messaging', stencils);
  registerStencil(r, 'security', 'Security Access Portal', stencils);
  registerStencil(r, 'security', 'Sharing Policy', stencils);
  registerStencil(r, 'security', 'Split Domain User', stencils);
  registerStencil(r, 'security', 'Token Service', stencils);
  registerStencil(r, 'security', 'Token', stencils);
  registerStencil(r, 'security', 'Token', stencils);
  registerStencil(r, 'security', 'Trusted Application Server', stencils);
  registerStencil(r, 'security', 'UM Mailbox Policy', stencils);
  registerStencil(r, 'security', 'Universal Security Group', stencils);
};

export const registerOfficeDevicesShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/devices.xml',
    'black',
    'white'
  );

  registerStencil(r, 'devices', 'Bluetooth', stencils);
  registerStencil(r, 'devices', 'CD DVD', stencils);
  registerStencil(r, 'devices', 'Cell phone Android Proportional', stencils);
  registerStencil(r, 'devices', 'Cell phone Android Standalone', stencils);
  registerStencil(r, 'devices', 'Cell phone Generic', stencils);
  registerStencil(r, 'devices', 'Cell phone Windows Phone Proportional', stencils);
  registerStencil(r, 'devices', 'Cell phone Windows Phone Standalone', stencils);
  registerStencil(r, 'devices', 'Cell phone iPhone Proportional', stencils);
  registerStencil(r, 'devices', 'Cell phone iPhone Standalone', stencils);
  registerStencil(r, 'devices', 'Data Jack', stencils);
  registerStencil(r, 'devices', 'Device Update Service', stencils);
  registerStencil(r, 'devices', 'Fax', stencils);
  registerStencil(r, 'devices', 'Hard Disk', stencils);
  registerStencil(r, 'devices', 'Headset', stencils);
  registerStencil(r, 'devices', 'IP Gateway', stencils);
  registerStencil(r, 'devices', 'IP PBX', stencils);
  registerStencil(r, 'devices', 'LCD Monitor', stencils);
  registerStencil(r, 'devices', 'Laptop', stencils);
  registerStencil(r, 'devices', 'Load Balancer', stencils);
  registerStencil(r, 'devices', 'Mac Client', stencils);
  registerStencil(r, 'devices', 'Management Console', stencils);
  registerStencil(r, 'devices', 'Microphone', stencils);
  registerStencil(r, 'devices', 'Modem', stencils);
  registerStencil(r, 'devices', 'NIC', stencils);
  registerStencil(r, 'devices', 'Phone Digital', stencils);
  registerStencil(r, 'devices', 'Phone Traditional', stencils);
  registerStencil(r, 'devices', 'Phone USB', stencils);
  registerStencil(r, 'devices', 'Phone VOIP', stencils);
  registerStencil(r, 'devices', 'Printer', stencils);
  registerStencil(r, 'devices', 'Roundtable', stencils);
  registerStencil(r, 'devices', 'Router', stencils);
  registerStencil(r, 'devices', 'Session Border Controller', stencils);
  registerStencil(r, 'devices', 'Shadowed Router', stencils);
  registerStencil(r, 'devices', 'Stylus', stencils);
  registerStencil(r, 'devices', 'Switch', stencils);
  registerStencil(r, 'devices', 'TV', stencils);
  registerStencil(r, 'devices', 'Tablet Android', stencils);
  registerStencil(r, 'devices', 'Tablet Windows 7inch', stencils);
  registerStencil(r, 'devices', 'Tablet Windows 8', stencils);
  registerStencil(r, 'devices', 'Tablet iPad', stencils);
  registerStencil(r, 'devices', 'Video Camera', stencils);
  registerStencil(r, 'devices', 'Video Gateway', stencils);
  registerStencil(r, 'devices', 'Webcam HD', stencils);
  registerStencil(r, 'devices', 'Webcam', stencils);
  registerStencil(r, 'devices', 'Workstation PC', stencils);
  registerStencil(r, 'devices', 'Workstation Visual Studio', stencils);
  registerStencil(r, 'devices', 'Workstation', stencils);
  registerStencil(r, 'devices', 'iPad Mini', stencils);
};

export const registerOfficeCommunicationsShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/communications.xml',
    'white',
    'green'
  );

  registerStencil(r, 'communications', '3rd Party Call Center Solution', stencils);
  registerStencil(r, 'communications', '3rd Party Integration', stencils);
  registerStencil(r, 'communications', '3rd Party Service', stencils);
  registerStencil(r, 'communications', 'Application Sharing Workload', stencils);
  registerStencil(r, 'communications', 'Audio Conferencing Application', stencils);
  registerStencil(r, 'communications', 'Central Management Service', stencils);
  registerStencil(r, 'communications', 'Chat Room', stencils);
  registerStencil(r, 'communications', 'Conference Announcement Service', stencils);
  registerStencil(r, 'communications', 'Disconnected Mailbox', stencils);
  registerStencil(r, 'communications', 'Discovery Search Mailbox', stencils);
  registerStencil(r, 'communications', 'Dynamic Distribution Group', stencils);
  registerStencil(r, 'communications', 'Edge Subscription', stencils);
  registerStencil(r, 'communications', 'Email Workloaad', stencils);
  registerStencil(r, 'communications', 'Equipment Mailbox', stencils);
  registerStencil(r, 'communications', 'Exchange Active Sync', stencils);
  registerStencil(r, 'communications', 'Fax Partner', stencils);
  registerStencil(r, 'communications', 'Global Address List', stencils);
  registerStencil(r, 'communications', 'Hybrid VOIP Gateway', stencils);
  registerStencil(r, 'communications', 'IM Workload', stencils);
  registerStencil(r, 'communications', 'Journaling Rule', stencils);
  registerStencil(r, 'communications', 'Local Move Request', stencils);
  registerStencil(r, 'communications', 'Lync Control Panel', stencils);
  registerStencil(r, 'communications', 'Lync Phone Edition', stencils);
  registerStencil(r, 'communications', 'Lync Room System', stencils);
  registerStencil(r, 'communications', 'Lync Server Management Tool', stencils);
  registerStencil(r, 'communications', 'Lync Storage Service', stencils);
  registerStencil(r, 'communications', 'Lync Web App Client', stencils);
  registerStencil(r, 'communications', 'Mail Enabled Public Folder', stencils);
  registerStencil(r, 'communications', 'Mailbox Assistant', stencils);
  registerStencil(r, 'communications', 'Messages Queued', stencils);
  registerStencil(r, 'communications', 'Offline Address Book', stencils);
  registerStencil(r, 'communications', 'Personal Archive Mailbox', stencils);
  registerStencil(r, 'communications', 'Public IM Cloud Service', stencils);
  registerStencil(r, 'communications', 'Push Notification Service', stencils);
  registerStencil(r, 'communications', 'Queue Viewer', stencils);
  registerStencil(r, 'communications', 'Remote Mailbox', stencils);
  registerStencil(r, 'communications', 'Remote Move Request', stencils);
  registerStencil(r, 'communications', 'Response Group', stencils);
  registerStencil(r, 'communications', 'Room Mailbox', stencils);
  registerStencil(r, 'communications', 'SIP URI UM Dial Plan', stencils);
  registerStencil(r, 'communications', 'SMS Gateway', stencils);
  registerStencil(r, 'communications', 'SMTP Connector', stencils);
  registerStencil(r, 'communications', 'Shared Mailbox', stencils);
  registerStencil(r, 'communications', 'Site Mailbox', stencils);
  registerStencil(r, 'communications', 'Skype for Business Control Panel', stencils);
  registerStencil(r, 'communications', 'Skype for Business Phone Edition', stencils);
  registerStencil(r, 'communications', 'Skype for Business Room System', stencils);
  registerStencil(r, 'communications', 'Skype for Business Server Management Tool', stencils);
  registerStencil(r, 'communications', 'Skype for Business Storage Service', stencils);
  registerStencil(r, 'communications', 'Skype for Business Web App Client', stencils);
  registerStencil(r, 'communications', 'System Mailbox', stencils);
  registerStencil(r, 'communications', 'TDM PBX', stencils);
  registerStencil(r, 'communications', 'Telephone Extension Dial Plan', stencils);
  registerStencil(r, 'communications', 'Transport Rule', stencils);
  registerStencil(r, 'communications', 'UCMA Application', stencils);
  registerStencil(r, 'communications', 'UCWA Application', stencils);
  registerStencil(r, 'communications', 'UM Auto Attendant', stencils);
  registerStencil(r, 'communications', 'UM Dial Plan E164', stencils);
  registerStencil(r, 'communications', 'UM Dial Plan Secondary', stencils);
  registerStencil(r, 'communications', 'UM Enabled Mailbox', stencils);
  registerStencil(r, 'communications', 'UM Hunt Group', stencils);
  registerStencil(r, 'communications', 'UM IP Gateway', stencils);
  registerStencil(r, 'communications', 'User Mailbox', stencils);
  registerStencil(r, 'communications', 'VOIP Gateway', stencils);
  registerStencil(r, 'communications', 'Video Workload', stencils);
  registerStencil(r, 'communications', 'Voice Mail Preview', stencils);
  registerStencil(r, 'communications', 'Voice Workload', stencils);
  registerStencil(r, 'communications', 'Watcher Node', stencils);
  registerStencil(r, 'communications', 'XMPP Service', stencils);
};

export const registerOfficeCloudsShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/clouds.xml',
    'black',
    'white'
  );

  registerStencil(r, 'clouds', 'Azure', stencils);
  registerStencil(r, 'clouds', 'Cloud', stencils);
  registerStencil(r, 'clouds', 'Cloud Disaster', stencils);
  registerStencil(r, 'clouds', 'Cloud Exchange Online', stencils);
  registerStencil(r, 'clouds', 'Cloud Service Request', stencils);
  registerStencil(r, 'clouds', 'Cloud Sharepoint', stencils);
  registerStencil(r, 'clouds', 'Office 365', stencils);
  registerStencil(r, 'clouds', 'Online Backup', stencils);
  registerStencil(r, 'clouds', 'Online User', stencils);
  registerStencil(r, 'clouds', 'Private Cloud', stencils);
  registerStencil(r, 'clouds', 'Public Cloud', stencils);
  registerStencil(r, 'clouds', 'Public IM Cloud Service', stencils);
};

export const registerOfficeServicesShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/services.xml',
    'black',
    'white'
  );

  registerStencil(r, 'services', '3rd party Service', stencils);
  registerStencil(r, 'services', 'Access Services', stencils);
  registerStencil(r, 'services', 'Business Connectivity Services', stencils);
  registerStencil(r, 'services', 'Call Admission Control Service', stencils);
  registerStencil(r, 'services', 'Central Management Service', stencils);
  registerStencil(r, 'services', 'Conference Announcement Service', stencils);
  registerStencil(r, 'services', 'Lync Storage Service', stencils);
  registerStencil(r, 'services', 'Outlook Web App', stencils);
  registerStencil(r, 'services', 'Skype For Business Storage Service', stencils);
  registerStencil(r, 'services', 'XMPP Service', stencils);
  registerStencil(r, 'services', 'Device Update Service', stencils);
  registerStencil(r, 'services', 'Lync Web App Client', stencils);
  registerStencil(r, 'services', 'PowerPoint Automation Services', stencils);
  registerStencil(r, 'services', 'User Services', stencils);
  registerStencil(r, 'services', 'Email Service', stencils);
  registerStencil(r, 'services', 'Mobility Service', stencils);
  registerStencil(r, 'services', 'Push Notification Service', stencils);
  registerStencil(r, 'services', 'Verification Service', stencils);
  registerStencil(r, 'services', 'Excel Services', stencils);
  registerStencil(r, 'services', 'Network File Share Service', stencils);
  registerStencil(r, 'services', 'Registrar Service', stencils);
  registerStencil(r, 'services', 'Web Services', stencils);
  registerStencil(r, 'services', 'Federation Service', stencils);
  registerStencil(r, 'services', 'Online Hosted Services', stencils);
  registerStencil(r, 'services', 'Response Group Service', stencils);
  registerStencil(r, 'services', 'Word Automation Services', stencils);
};

export const registerOfficeUsersShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/users.xml',
    'black',
    'white'
  );

  registerStencil(r, 'users', 'Administrator', stencils);
  registerStencil(r, 'users', 'Approver', stencils);
  registerStencil(r, 'users', 'Call Center Agent', stencils);
  registerStencil(r, 'users', 'Communications', stencils);
  registerStencil(r, 'users', 'Conferencing Attendant', stencils);
  registerStencil(r, 'users', 'Credentials', stencils);
  registerStencil(r, 'users', 'CSV File', stencils);
  registerStencil(r, 'users', 'Distribution Group', stencils);
  registerStencil(r, 'users', 'Dynamic Distribution Group', stencils);
  registerStencil(r, 'users', 'Mail User', stencils);
  registerStencil(r, 'users', 'Meeting', stencils);
  registerStencil(r, 'users', 'Mobile User', stencils);
  registerStencil(r, 'users', 'Online User', stencils);
  registerStencil(r, 'users', 'On Premises User', stencils);
  registerStencil(r, 'users', 'Outlook User', stencils);
  registerStencil(r, 'users', 'Response Group', stencils);
  registerStencil(r, 'users', 'Role Group', stencils);
  registerStencil(r, 'users', 'Skype Commercial User', stencils);
  registerStencil(r, 'users', 'Skype For Business User', stencils);
  registerStencil(r, 'users', 'Tenant Admin', stencils);
  registerStencil(r, 'users', 'UM Enabled User', stencils);
  registerStencil(r, 'users', 'Universal Security Group', stencils);
  registerStencil(r, 'users', 'User', stencils);
  registerStencil(r, 'users', 'Users', stencils);
  registerStencil(r, 'users', 'Users Two', stencils);
  registerStencil(r, 'users', 'User Accounts', stencils);
  registerStencil(r, 'users', 'User External', stencils);
  registerStencil(r, 'users', 'User Services', stencils);
  registerStencil(r, 'users', 'User Store', stencils);
  registerStencil(r, 'users', 'Writer', stencils);
};

export const registerOfficeSitesShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/sites.xml',
    'black',
    'white'
  );

  registerStencil(r, 'sites', 'Access Services', stencils);
  registerStencil(r, 'sites', 'My Site', stencils);
  registerStencil(r, 'sites', 'Site Team', stencils);
  registerStencil(r, 'sites', 'Subsite', stencils);
  registerStencil(r, 'sites', 'Wiki Site', stencils);
  registerStencil(r, 'sites', 'Blog Site', stencils);
  registerStencil(r, 'sites', 'PowerPoint Automation Services', stencils);
  registerStencil(r, 'sites', 'Word Automation Services', stencils);
  registerStencil(r, 'sites', 'Business Connectivity Services', stencils);
  registerStencil(r, 'sites', 'Publish', stencils);
  registerStencil(r, 'sites', 'Upgrade Site', stencils);
  registerStencil(r, 'sites', 'Excel Services', stencils);
  registerStencil(r, 'sites', 'Site Collection', stencils);
  registerStencil(r, 'sites', 'Website', stencils);
  registerStencil(r, 'sites', 'Meeting Workspace Site', stencils);
  registerStencil(r, 'sites', 'Site Shared', stencils);
  registerStencil(r, 'sites', 'Website Public', stencils);
};

export const registerOfficeDatabasesShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/databases.xml',
    'black',
    'white'
  );

  registerStencil(r, 'databases', 'Address Book Store', stencils);
  registerStencil(r, 'databases', 'Application Store', stencils);
  registerStencil(r, 'databases', 'Database', stencils);
  registerStencil(r, 'databases', 'Database Availability Group', stencils);
  registerStencil(r, 'databases', 'Database Cube', stencils);
  registerStencil(r, 'databases', 'Database Mini 1', stencils);
  registerStencil(r, 'databases', 'Database Mini 2', stencils);
  registerStencil(r, 'databases', 'Database Mini 3', stencils);
  registerStencil(r, 'databases', 'Database Mirror', stencils);
  registerStencil(r, 'databases', 'Database Mirror Witness Node', stencils);
  registerStencil(r, 'databases', 'Database Partition 2', stencils);
  registerStencil(r, 'databases', 'Database Partition 3', stencils);
  registerStencil(r, 'databases', 'Database Partition 4', stencils);
  registerStencil(r, 'databases', 'Database Partition 5', stencils);
  registerStencil(r, 'databases', 'Database Public Folder', stencils);
  registerStencil(r, 'databases', 'Database Server', stencils);
  registerStencil(r, 'databases', 'Database Server Blue', stencils);
  registerStencil(r, 'databases', 'Database Server Orange', stencils);
  registerStencil(r, 'databases', 'Database Server Green', stencils);
  registerStencil(r, 'databases', 'Database Server Ghosted', stencils);
  registerStencil(r, 'databases', 'Mailbox Database', stencils);
  registerStencil(r, 'databases', 'Monitoring Store', stencils);
  registerStencil(r, 'databases', 'Unified Contact Store', stencils);
  registerStencil(r, 'databases', 'Web Store', stencils);
};

export const registerOfficeConceptShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/office/concepts.xml',
    'black',
    'white'
  );

  registerStencil(r, 'concepts', 'Address Book', stencils);
  registerStencil(r, 'concepts', 'Anti Spam', stencils);
  registerStencil(r, 'concepts', 'App Part', stencils);
  registerStencil(r, 'concepts', 'App for Office', stencils);
  registerStencil(r, 'concepts', 'App for Sharepoint', stencils);
  registerStencil(r, 'concepts', 'Application Android', stencils);
  registerStencil(r, 'concepts', 'Application Generic', stencils);
  registerStencil(r, 'concepts', 'Application Hybrid', stencils);
  registerStencil(r, 'concepts', 'Application Web', stencils);
  registerStencil(r, 'concepts', 'Application Windows', stencils);
  registerStencil(r, 'concepts', 'Application iOS', stencils);
  registerStencil(r, 'concepts', 'Archive', stencils);
  registerStencil(r, 'concepts', 'Attachment', stencils);
  registerStencil(r, 'concepts', 'Backup Local', stencils);
  registerStencil(r, 'concepts', 'Backup Online', stencils);
  registerStencil(r, 'concepts', 'Bandwidth Calculator', stencils);
  registerStencil(r, 'concepts', 'Bandwidth', stencils);
  registerStencil(r, 'concepts', 'Best Practices', stencils);
  registerStencil(r, 'concepts', 'Book Journal', stencils);
  registerStencil(r, 'concepts', 'Calculator', stencils);
  registerStencil(r, 'concepts', 'Calendar', stencils);
  registerStencil(r, 'concepts', 'Clipboard', stencils);
  registerStencil(r, 'concepts', 'Clock', stencils);
  registerStencil(r, 'concepts', 'Column', stencils);
  registerStencil(r, 'concepts', 'Connector', stencils);
  registerStencil(r, 'concepts', 'Contacts', stencils);
  registerStencil(r, 'concepts', 'Content Type', stencils);
  registerStencil(r, 'concepts', 'Credit Card', stencils);
  registerStencil(r, 'concepts', 'Document Blank', stencils);
  registerStencil(r, 'concepts', 'Document Shared', stencils);
  registerStencil(r, 'concepts', 'Document', stencils);
  registerStencil(r, 'concepts', 'Documents Shared', stencils);
  registerStencil(r, 'concepts', 'Documents', stencils);
  registerStencil(r, 'concepts', 'Download', stencils);
  registerStencil(r, 'concepts', 'Email Approved', stencils);
  registerStencil(r, 'concepts', 'Email Expired', stencils);
  registerStencil(r, 'concepts', 'Email Rejected', stencils);
  registerStencil(r, 'concepts', 'Email', stencils);
  registerStencil(r, 'concepts', 'File Key', stencils);
  registerStencil(r, 'concepts', 'Firewall', stencils);
  registerStencil(r, 'concepts', 'Folder Open', stencils);
  registerStencil(r, 'concepts', 'Folder Public', stencils);
  registerStencil(r, 'concepts', 'Folder Shared', stencils);
  registerStencil(r, 'concepts', 'Folder', stencils);
  registerStencil(r, 'concepts', 'Folders', stencils);
  registerStencil(r, 'concepts', 'Form', stencils);
  registerStencil(r, 'concepts', 'Get Started', stencils);
  registerStencil(r, 'concepts', 'Globe Internet', stencils);
  registerStencil(r, 'concepts', 'Help', stencils);
  registerStencil(r, 'concepts', 'Home Page', stencils);
  registerStencil(r, 'concepts', 'Home', stencils);
  registerStencil(r, 'concepts', 'Hybrid', stencils);
  registerStencil(r, 'concepts', 'Input Output Filter', stencils);
  registerStencil(r, 'concepts', 'Install', stencils);
  registerStencil(r, 'concepts', 'Integration', stencils);
  registerStencil(r, 'concepts', 'Lab', stencils);
  registerStencil(r, 'concepts', 'Learn', stencils);
  registerStencil(r, 'concepts', 'License', stencils);
  registerStencil(r, 'concepts', 'Link', stencils);
  registerStencil(r, 'concepts', 'List Library', stencils);
  registerStencil(r, 'concepts', 'Mailbox', stencils);
  registerStencil(r, 'concepts', 'Mailbox2', stencils);
  registerStencil(r, 'concepts', 'Maintenance', stencils);
  registerStencil(r, 'concepts', 'Marketplace Shopping Bag', stencils);
  registerStencil(r, 'concepts', 'Meets Requirements', stencils);
  registerStencil(r, 'concepts', 'Migration', stencils);
  registerStencil(r, 'concepts', 'Moes', stencils);
  registerStencil(r, 'concepts', 'Navigation', stencils);
  registerStencil(r, 'concepts', 'Node Generic', stencils);
  registerStencil(r, 'concepts', 'Office Installed', stencils);
  registerStencil(r, 'concepts', 'On Premises Directory', stencils);
  registerStencil(r, 'concepts', 'On Premises', stencils);
  registerStencil(r, 'concepts', 'Phishing', stencils);
  registerStencil(r, 'concepts', 'Pin', stencils);
  registerStencil(r, 'concepts', 'Platform Options', stencils);
  registerStencil(r, 'concepts', 'Powershell', stencils);
  registerStencil(r, 'concepts', 'Properties', stencils);
  registerStencil(r, 'concepts', 'Publish', stencils);
  registerStencil(r, 'concepts', 'Remote Access', stencils);
  registerStencil(r, 'concepts', 'Script', stencils);
  registerStencil(r, 'concepts', 'Search', stencils);
  registerStencil(r, 'concepts', 'Service Application', stencils);
  registerStencil(r, 'concepts', 'Settings Office 365', stencils);
  registerStencil(r, 'concepts', 'Settings', stencils);
  registerStencil(r, 'concepts', 'Sign Up', stencils);
  registerStencil(r, 'concepts', 'Sound File', stencils);
  registerStencil(r, 'concepts', 'Tasks', stencils);
  registerStencil(r, 'concepts', 'Technical Diagram', stencils);
  registerStencil(r, 'concepts', 'Upgrade Application', stencils);
  registerStencil(r, 'concepts', 'Upgrade Server', stencils);
  registerStencil(r, 'concepts', 'Upgrade Site', stencils);
  registerStencil(r, 'concepts', 'Upload', stencils);
  registerStencil(r, 'concepts', 'Video Form', stencils);
  registerStencil(r, 'concepts', 'Video Play', stencils);
  registerStencil(r, 'concepts', 'Voicemail Preview', stencils);
  registerStencil(r, 'concepts', 'Voicemail', stencils);
  registerStencil(r, 'concepts', 'Walkthrough', stencils);
  registerStencil(r, 'concepts', 'Web Conferencing', stencils);
  registerStencil(r, 'concepts', 'Web Page', stencils);
  registerStencil(r, 'concepts', 'Web Part', stencils);
  registerStencil(r, 'concepts', 'Web Services', stencils);
  registerStencil(r, 'concepts', 'Website', stencils);
  registerStencil(r, 'concepts', 'Whats new', stencils);
  registerStencil(r, 'concepts', 'Writing Pen', stencils);
  registerStencil(r, 'concepts', 'Writing Pencil', stencils);
};
