import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioShapeNodeDefinition } from '../DrawioShape.nodeType';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<DrawioStencil>
) => {
  const stencil = findStencilByName(stencils, name);

  registry.register(
    new DrawioShapeNodeDefinition(`mxgraph.citrix.${toTypeName(name)}`, name, stencil)
  );
};

export const registerCitrixShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils('/stencils/citrix.xml', 'Citrix');

  registerStencil(r, '1U 2U Server', stencils);
  registerStencil(r, 'Access Card', stencils);
  registerStencil(r, 'Branch Repeater', stencils);
  registerStencil(r, 'Browser', stencils);
  registerStencil(r, 'Cache Server', stencils);
  registerStencil(r, 'Calendar', stencils);
  registerStencil(r, 'Cell Phone', stencils);
  registerStencil(r, 'Chassis', stencils);
  registerStencil(r, 'Citrix HDX', stencils);
  registerStencil(r, 'Citrix Logo', stencils);
  registerStencil(r, 'Cloud', stencils);
  registerStencil(r, 'Command Center', stencils);
  registerStencil(r, 'DHCP Server', stencils);
  registerStencil(r, 'DNS Server', stencils);
  registerStencil(r, 'Database Server', stencils);
  registerStencil(r, 'Database', stencils);
  registerStencil(r, 'Datacenter', stencils);
  registerStencil(r, 'Desktop Web', stencils);
  registerStencil(r, 'Desktop', stencils);
  registerStencil(r, 'Directory Server', stencils);
  registerStencil(r, 'Document', stencils);
  registerStencil(r, 'EdgeSight Server', stencils);
  registerStencil(r, 'FTP Server', stencils);
  registerStencil(r, 'File Server', stencils);
  registerStencil(r, 'Firewall', stencils);
  registerStencil(r, 'Geolocation Database', stencils);
  registerStencil(r, 'Globe', stencils);
  registerStencil(r, 'Goto Meeting', stencils);
  registerStencil(r, 'Government', stencils);
  registerStencil(r, 'HQ Enterprise', stencils);
  registerStencil(r, 'Home Office', stencils);
  registerStencil(r, 'IP Phone', stencils);
  registerStencil(r, 'Inspection', stencils);
  registerStencil(r, 'Kiosk', stencils);
  registerStencil(r, 'Laptop 1', stencils);
  registerStencil(r, 'Laptop 2', stencils);
  registerStencil(r, 'License Server', stencils);
  registerStencil(r, 'Merchandising Server', stencils);
  registerStencil(r, 'Middleware', stencils);
  registerStencil(r, 'Netscaler Gateway', stencils);
  registerStencil(r, 'Netscaler MPX', stencils);
  registerStencil(r, 'Netscaler SDX', stencils);
  registerStencil(r, 'Netscaler VPX', stencils);
  registerStencil(r, 'PBX Server', stencils);
  registerStencil(r, 'PDA', stencils);
  registerStencil(r, 'Podio', stencils);
  registerStencil(r, 'Printer', stencils);
  registerStencil(r, 'Process', stencils);
  registerStencil(r, 'Provisioning Server', stencils);
  registerStencil(r, 'Proxy Server', stencils);
  registerStencil(r, 'Radius Server', stencils);
  registerStencil(r, 'Remote Office', stencils);
  registerStencil(r, 'Reporting', stencils);
  registerStencil(r, 'Role AppController', stencils);
  registerStencil(r, 'Role Applications', stencils);
  registerStencil(r, 'Role Cloudbridge', stencils);
  registerStencil(r, 'Role Desktops', stencils);
  registerStencil(r, 'Role Load Testing Controller', stencils);
  registerStencil(r, 'Role Load Testing Launcher', stencils);
  registerStencil(r, 'Role Receiver', stencils);
  registerStencil(r, 'Role Repeater', stencils);
  registerStencil(r, 'Role Secure Access', stencils);
  registerStencil(r, 'Role Security', stencils);
  registerStencil(r, 'Role Services', stencils);
  registerStencil(r, 'Role Storefront Services', stencils);
  registerStencil(r, 'Role Storefront', stencils);
  registerStencil(r, 'Role Synchronizer', stencils);
  registerStencil(r, 'Role XenMobile device manager', stencils);
  registerStencil(r, 'Role XenMobile', stencils);
  registerStencil(r, 'Router', stencils);
  registerStencil(r, 'SMTP Server', stencils);
  registerStencil(r, 'Security', stencils);
  registerStencil(r, 'Sharefile', stencils);
  registerStencil(r, 'Site', stencils);
  registerStencil(r, 'Storefront Services', stencils);
  registerStencil(r, 'Switch', stencils);
  registerStencil(r, 'Tablet 1', stencils);
  registerStencil(r, 'Tablet 2', stencils);
  registerStencil(r, 'Thin Client', stencils);
  registerStencil(r, 'Tower Server', stencils);
  registerStencil(r, 'User Control', stencils);
  registerStencil(r, 'Users', stencils);
  registerStencil(r, 'Web Server', stencils);
  registerStencil(r, 'Web Service', stencils);
  registerStencil(r, 'WorxEnroll', stencils);
  registerStencil(r, 'WorxMail', stencils);
  registerStencil(r, 'WorxWeb', stencils);
  registerStencil(r, 'Worxhome', stencils);
  registerStencil(r, 'XenCenter', stencils);
  registerStencil(r, 'XenClient Synchronizer', stencils);
  registerStencil(r, 'XenClient', stencils);
  registerStencil(r, 'XenDesktop Server', stencils);
  registerStencil(r, 'XenMobile', stencils);
  registerStencil(r, 'XenServer', stencils);
  registerStencil(r, 'Xenapp Server', stencils);
  registerStencil(r, 'Xenapp Services', stencils);
  registerStencil(r, 'Xenapp Web', stencils);
};
