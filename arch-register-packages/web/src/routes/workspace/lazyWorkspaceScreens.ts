import { lazyRouteComponent } from '@tanstack/react-router';

export const LazyProjectsScreen = lazyRouteComponent(
  () => import('../../sections/projects/ProjectsScreen'),
  'ProjectsScreen'
);
export const LazyProjectDetailScreen = lazyRouteComponent(
  () => import('../../sections/projects/ProjectDetailScreen'),
  'ProjectDetailScreen'
);
export const LazyDiagramScreen = lazyRouteComponent(
  () => import('../../sections/projects/DiagramScreen'),
  'DiagramScreen'
);
export const LazyMarkdownEditorScreen = lazyRouteComponent(
  () => import('../../sections/markdown/MarkdownEditorScreen'),
  'MarkdownEditorScreen'
);
export const LazyWorkspaceContentRoute = lazyRouteComponent(
  () => import('./WorkspaceContentRoute'),
  'WorkspaceContentRoute'
);
export const LazyWorkspaceContentFolderRoute = lazyRouteComponent(
  () => import('./WorkspaceContentRoute'),
  'WorkspaceContentFolderRoute'
);
export const LazyEntityBrowserScreen = lazyRouteComponent(
  () => import('../../sections/entities/EntityBrowserScreen'),
  'EntityBrowserScreen'
);
export const LazyEntityDetailScreen = lazyRouteComponent(
  () => import('../../sections/entities/EntityDetailScreen'),
  'EntityDetailScreen'
);
export const LazyImportScreen = lazyRouteComponent(
  () => import('../../sections/entities/ImportScreen'),
  'ImportScreen'
);
export const LazyRelationBrowserScreen = lazyRouteComponent(
  () => import('../../sections/relations/RelationBrowserScreen'),
  'RelationBrowserScreen'
);
export const LazyRelationImportScreen = lazyRouteComponent(
  () => import('../../sections/relations/RelationImportScreen'),
  'RelationImportScreen'
);
export const LazyAssistantScreen = lazyRouteComponent(
  () => import('../../sections/ai-assistant/AssistantScreen'),
  'AssistantScreen'
);
export const LazyExtractScreen = lazyRouteComponent(
  () => import('../../sections/ai-extract/ExtractScreen'),
  'ExtractScreen'
);
export const LazySearchScreen = lazyRouteComponent(
  () => import('../../sections/search/SearchScreen'),
  'SearchScreen'
);
export const LazyGlossaryDashboardScreen = lazyRouteComponent(
  () => import('../../app/business-glossary/sections/GlossaryDashboardScreen'),
  'GlossaryDashboardScreen'
);
export const LazyStrategyOverviewDashboardScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyOverviewDashboardScreen'),
  'StrategyOverviewDashboardScreen'
);
export const LazyStrategyCapabilityMapDashboardScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyCapabilityMapDashboardScreen'),
  'StrategyCapabilityMapDashboardScreen'
);
export const LazyStrategyCapabilitiesDashboardScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyCapabilitiesDashboardScreen'),
  'StrategyCapabilitiesDashboardScreen'
);
export const LazyStrategyHeatmapsScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyHeatmapsScreen'),
  'StrategyHeatmapsScreen'
);
export const LazyStrategyStrategyDashboardScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyStrategyDashboardScreen'),
  'StrategyStrategyDashboardScreen'
);
export const LazyStrategyTraceabilityDashboardScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyTraceabilityDashboardScreen'),
  'StrategyTraceabilityDashboardScreen'
);
export const LazyVendorOverviewDashboardScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorOverviewDashboardScreen'),
  'VendorOverviewDashboardScreen'
);
export const LazyVendorVendorsDashboardScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorVendorsDashboardScreen'),
  'VendorVendorsDashboardScreen'
);
export const LazyVendorContractsDashboardScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorContractsDashboardScreen'),
  'VendorContractsDashboardScreen'
);
export const LazyVendorSpendScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorSpendScreen'),
  'VendorSpendScreen'
);
export const LazyVendorRiskScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorRiskScreen'),
  'VendorRiskScreen'
);
export const LazyRiskComplianceOverviewDashboardScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceOverviewDashboardScreen'),
  'RiskComplianceOverviewDashboardScreen'
);
export const LazyRiskComplianceRisksDashboardScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceRisksDashboardScreen'),
  'RiskComplianceRisksDashboardScreen'
);
export const LazyRiskComplianceControlsDashboardScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceControlsDashboardScreen'),
  'RiskComplianceControlsDashboardScreen'
);
export const LazyRiskComplianceRetentionDashboardScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceRetentionDashboardScreen'),
  'RiskComplianceRetentionDashboardScreen'
);
export const LazyRiskComplianceAssessmentsDashboardScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceAssessmentsDashboardScreen'),
  'RiskComplianceAssessmentsDashboardScreen'
);
export const LazyDataStewardshipDashboardScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipDashboardScreen'),
  'DataStewardshipDashboardScreen'
);
export const LazyDataStewardshipStewardshipDashboardScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipStewardshipDashboardScreen'),
  'DataStewardshipStewardshipDashboardScreen'
);
export const LazyDataStewardshipClassificationDashboardScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipClassificationDashboardScreen'),
  'DataStewardshipClassificationDashboardScreen'
);
export const LazyDataStewardshipChangeCasesDashboardScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipChangeCasesDashboardScreen'),
  'DataStewardshipChangeCasesDashboardScreen'
);
export const LazyDataStewardshipAssessmentsDashboardScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipAssessmentsDashboardScreen'),
  'DataStewardshipAssessmentsDashboardScreen'
);
export const LazyApiIntegrationCatalogOverviewDashboard = lazyRouteComponent(
  () => import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogDashboardScreens'),
  'ApiIntegrationCatalogOverviewDashboard'
);
export const LazyApiIntegrationCatalogApisScreen = lazyRouteComponent(
  () => import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogApisScreen'),
  'ApiIntegrationCatalogApisScreen'
);
export const LazyApiIntegrationCatalogIntegrationsScreen = lazyRouteComponent(
  () =>
    import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogIntegrationsScreen'),
  'ApiIntegrationCatalogIntegrationsScreen'
);
export const LazyIntegrationSyncScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/IntegrationSyncScreen'),
  'IntegrationSyncScreen'
);
export const LazyApiIntegrationCatalogImpactDashboard = lazyRouteComponent(
  () => import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogDashboardScreens'),
  'ApiIntegrationCatalogImpactDashboard'
);
export const LazyWorkspaceSettingsScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/WorkspaceSettingsScreen'),
  'WorkspaceSettingsScreen'
);
export const LazySchemaSettingsScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/SchemaSettingsScreen'),
  'SchemaSettingsScreen'
);
export const LazySchemaGraphView = lazyRouteComponent(
  () => import('../../sections/workspace-settings/SchemaGraphView'),
  'SchemaGraphView'
);
export const LazySchemaValidationScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/SchemaValidationScreen'),
  'SchemaValidationScreen'
);
export const LazyDocumentSettingsScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/DocumentSettingsScreen'),
  'DocumentSettingsScreen'
);
export const LazyApplicationsCapabilitiesScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/ApplicationsCapabilitiesScreen'),
  'ApplicationsCapabilitiesScreen'
);
export const LazyGlobalSettingsScreen = lazyRouteComponent(
  () => import('../../sections/global-settings/GlobalSettingsScreen'),
  'GlobalSettingsScreen'
);
export const LazyAccountSettingsScreen = lazyRouteComponent(
  () => import('../../sections/account-settings/AccountSettingsScreen'),
  'AccountSettingsScreen'
);
