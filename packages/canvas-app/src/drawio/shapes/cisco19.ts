import { loadStencil } from '../stencilLoader';
import { NodeDefinitionRegistry, Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import { Style } from '../drawioReader';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { findStencilByName, stencilNameToType } from './shapeUtils';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<Stencil>
) => {
  const stencil = findStencilByName(stencils, name);

  stencil.node.name = name;
  stencil.node.type = 'mxgraph.cisco19.' + stencilNameToType(name);

  registry.register(stencil.node, stencil);
};

export const parseCisco19Shapes = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  style: Style,
  diagram: Diagram,
  layer: Layer
): Promise<DiagramNode> => {
  if (style.shape === 'mxgraph.cisco19.rect') {
    props.fill!.color = '#005073';
    return new DiagramNode(id, 'mxgraph.cisco19.' + style.prIcon, bounds, diagram, layer, props);
  }

  return new DiagramNode(id, style.shape!, bounds, diagram, layer, props);
};

export const registerCisco19Shapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadStencil('/stencils/cisco19.xml', 'Cisco19', '#005073', '#005073');

  registerStencil(r, '3g 4g Indicator', stencils);
  registerStencil(r, '6500 Vss', stencils);
  registerStencil(r, '6500 Vss2', stencils);
  registerStencil(r, 'ACI', stencils);
  registerStencil(r, 'ACS', stencils);
  registerStencil(r, 'Access Control And Trustsec', stencils);
  registerStencil(r, 'Ad Decoder', stencils);
  registerStencil(r, 'Ad Encoder', stencils);
  registerStencil(r, 'Analysis Correlation', stencils);
  registerStencil(r, 'Anomaly Detection', stencils);
  registerStencil(r, 'Anti Malware', stencils);
  registerStencil(r, 'Anti Malware2', stencils);
  registerStencil(r, 'Appnav', stencils);
  registerStencil(r, 'Asa 5500', stencils);
  registerStencil(r, 'Asr 1000', stencils);
  registerStencil(r, 'Asr 9000', stencils);
  registerStencil(r, 'Avc application visibility control', stencils);
  registerStencil(r, 'Avc application visibility control2', stencils);
  registerStencil(r, 'Blade server', stencils);
  registerStencil(r, 'Branch', stencils);
  registerStencil(r, 'Camera', stencils);
  registerStencil(r, 'Cell phone', stencils);
  registerStencil(r, 'Cisco 15800', stencils);
  registerStencil(r, 'Cisco dna center', stencils);
  registerStencil(r, 'Cisco dna', stencils);
  registerStencil(r, 'Cisco meetingplace express', stencils);
  registerStencil(r, 'Cisco security manager', stencils);
  registerStencil(r, 'Cisco unified contact center enterprise and hosted', stencils);
  registerStencil(r, 'Cisco unified presence service', stencils);
  registerStencil(r, 'Cloud', stencils);
  registerStencil(r, 'Cloud2', stencils);
  registerStencil(r, 'Cognitive', stencils);
  registerStencil(r, 'Collab1', stencils);
  registerStencil(r, 'Collab2', stencils);
  registerStencil(r, 'Collab3', stencils);
  registerStencil(r, 'Collab4', stencils);
  registerStencil(r, 'Communications manager', stencils);
  registerStencil(r, 'Content recording streaming server', stencils);
  registerStencil(r, 'Content router', stencils);
  registerStencil(r, 'Csr 1000v', stencils);
  registerStencil(r, 'Da decoder', stencils);
  registerStencil(r, 'Da encoder', stencils);
  registerStencil(r, 'Data center', stencils);
  registerStencil(r, 'Database relational', stencils);
  registerStencil(r, 'Dns server', stencils);
  registerStencil(r, 'Dual mode access point', stencils);
  registerStencil(r, 'Email security', stencils);
  registerStencil(r, 'Fabric interconnect', stencils);
  registerStencil(r, 'Fibre channel director mds 9000', stencils);
  registerStencil(r, 'Fibre channel fabric switch', stencils);
  registerStencil(r, 'Firewall', stencils);
  registerStencil(r, 'Flow analytics', stencils);
  registerStencil(r, 'Flow analytics2', stencils);
  registerStencil(r, 'Flow collector', stencils);
  registerStencil(r, 'H323', stencils);
  registerStencil(r, 'Handheld', stencils);
  registerStencil(r, 'Hdtv', stencils);
  registerStencil(r, 'Home office', stencils);
  registerStencil(r, 'Host based security', stencils);
  registerStencil(r, 'Hypervisor', stencils);
  registerStencil(r, 'Immersive telepresence endpoint', stencils);
  registerStencil(r, 'Ip phone', stencils);
  registerStencil(r, 'Ip telephone router', stencils);
  registerStencil(r, 'Ips ids', stencils);
  registerStencil(r, 'Ironport', stencils);
  registerStencil(r, 'Ise', stencils);
  registerStencil(r, 'Joystick keyboard', stencils);
  registerStencil(r, 'Key', stencils);
  registerStencil(r, 'L2 modular', stencils);
  registerStencil(r, 'L2 modular2', stencils);
  registerStencil(r, 'L2 switch with dual supervisor', stencils);
  registerStencil(r, 'L2 switch', stencils);
  registerStencil(r, 'L3 modular', stencils);
  registerStencil(r, 'L3 modular2', stencils);
  registerStencil(r, 'L3 modular3', stencils);
  registerStencil(r, 'L3 switch with dual supervisor', stencils);
  registerStencil(r, 'L3 switch', stencils);
  registerStencil(r, 'Laptop video client', stencils);
  registerStencil(r, 'Laptop', stencils);
  registerStencil(r, 'Layer3 nexus 5k switch', stencils);
  registerStencil(r, 'Ldap', stencils);
  registerStencil(r, 'Load balancer', stencils);
  registerStencil(r, 'Lock', stencils);
  registerStencil(r, 'Meeting scheduling and management server', stencils);
  registerStencil(r, 'Mesh access point', stencils);
  registerStencil(r, 'Monitor', stencils);
  registerStencil(r, 'Monitoring', stencils);
  registerStencil(r, 'Multipoint meeting server', stencils);
  registerStencil(r, 'Nac appliance', stencils);
  registerStencil(r, 'Nam virtual service blade', stencils);
  registerStencil(r, 'Net mgmt appliance', stencils);
  registerStencil(r, 'Netflow router', stencils);
  registerStencil(r, 'Netflow router2', stencils);
  registerStencil(r, 'Next generation intrusion prevention system', stencils);
  registerStencil(r, 'Nexus 1010', stencils);
  registerStencil(r, 'Nexus 1k', stencils);
  registerStencil(r, 'Nexus 1kv vsm', stencils);
  registerStencil(r, 'Nexus 2000 10ge', stencils);
  registerStencil(r, 'Nexus 2k', stencils);
  registerStencil(r, 'Nexus 3k', stencils);
  registerStencil(r, 'Nexus 4k', stencils);
  registerStencil(r, 'Nexus 5k with integrated vsm', stencils);
  registerStencil(r, 'Nexus 5k', stencils);
  registerStencil(r, 'Nexus 9300', stencils);
  registerStencil(r, 'Nexus 9500', stencils);
  registerStencil(r, 'Operations manager', stencils);
  registerStencil(r, 'Phone polycom', stencils);
  registerStencil(r, 'Policy configuration', stencils);
  registerStencil(r, 'Pos', stencils);
  registerStencil(r, 'Posture assessment', stencils);
  registerStencil(r, 'Primary codec', stencils);
  registerStencil(r, 'Printer', stencils);
  registerStencil(r, 'Router with firewall', stencils);
  registerStencil(r, 'Router with firewall2', stencils);
  registerStencil(r, 'Router with voice', stencils);
  registerStencil(r, 'Router', stencils);
  registerStencil(r, 'Rps', stencils);
  registerStencil(r, 'Secondary codec', stencils);
  registerStencil(r, 'Secure catalyst switch color', stencils);
  registerStencil(r, 'Secure catalyst switch color2', stencils);
  registerStencil(r, 'Secure catalyst switch color3', stencils);
  registerStencil(r, 'Secure catalyst switch subdued', stencils);
  registerStencil(r, 'Secure catalyst switch subdued2', stencils);
  registerStencil(r, 'Secure endpoint pc', stencils);
  registerStencil(r, 'Secure endpoints', stencils);
  registerStencil(r, 'Secure router', stencils);
  registerStencil(r, 'Secure server', stencils);
  registerStencil(r, 'Secure switch', stencils);
  registerStencil(r, 'Security management', stencils);
  registerStencil(r, 'Server', stencils);
  registerStencil(r, 'Service ready engine', stencils);
  registerStencil(r, 'Set top', stencils);
  registerStencil(r, 'Shield', stencils);
  registerStencil(r, 'Ssl terminator', stencils);
  registerStencil(r, 'Stealthwatch management console smc', stencils);
  registerStencil(r, 'Storage', stencils);
  registerStencil(r, 'Surveillance camera', stencils);
  registerStencil(r, 'Tablet', stencils);
  registerStencil(r, 'Telepresence endpoint twin data display', stencils);
  registerStencil(r, 'Telepresence endpoint', stencils);
  registerStencil(r, 'Telepresence exchange', stencils);
  registerStencil(r, 'Threat intelligence', stencils);
  registerStencil(r, 'Transcoder', stencils);
  registerStencil(r, 'Ucs 5108 blade chassis', stencils);
  registerStencil(r, 'Ucs c series server', stencils);
  registerStencil(r, 'Ucs express', stencils);
  registerStencil(r, 'Unity', stencils);
  registerStencil(r, 'Upc unified personal communicator', stencils);
  registerStencil(r, 'Ups', stencils);
  registerStencil(r, 'User', stencils);
  registerStencil(r, 'Vbond', stencils);
  registerStencil(r, 'Video analytics', stencils);
  registerStencil(r, 'Video call server', stencils);
  registerStencil(r, 'Video gateway', stencils);
  registerStencil(r, 'Virtual desktop service', stencils);
  registerStencil(r, 'Virtual matrix switch', stencils);
  registerStencil(r, 'Virtual private network connector', stencils);
  registerStencil(r, 'Virtual private network', stencils);
  registerStencil(r, 'Virtual private network2', stencils);
  registerStencil(r, 'Vmanage', stencils);
  registerStencil(r, 'Vpn concentrator', stencils);
  registerStencil(r, 'Vsmart', stencils);
  registerStencil(r, 'Vts', stencils);
  registerStencil(r, 'Web application firewall', stencils);
  registerStencil(r, 'Web reputation filtering 2', stencils);
  registerStencil(r, 'Web reputation filtering', stencils);
  registerStencil(r, 'Web security services', stencils);
  registerStencil(r, 'Web security services2', stencils);
  registerStencil(r, 'Web security', stencils);
  registerStencil(r, 'Wifi indicator', stencils);
  registerStencil(r, 'Wireless access point', stencils);
  registerStencil(r, 'Wireless bridge', stencils);
  registerStencil(r, 'Wireless intrusion prevention', stencils);
  registerStencil(r, 'Wireless lan controller', stencils);
  registerStencil(r, 'Wireless location appliance', stencils);
  registerStencil(r, 'Wireless router', stencils);
  registerStencil(r, 'Workgroup switch', stencils);
  registerStencil(r, 'Workstation', stencils);
  registerStencil(r, 'X509 certificate', stencils);
};
