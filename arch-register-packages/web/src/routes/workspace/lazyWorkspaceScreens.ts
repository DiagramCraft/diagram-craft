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
export const LazyGlossaryScreen = lazyRouteComponent(
  () => import('../../app/business-glossary/sections/GlossaryScreen'),
  'GlossaryScreen'
);
export const LazyStrategyOverviewScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyOverviewScreen'),
  'StrategyOverviewScreen'
);
export const LazyStrategyCapabilityMapScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyCapabilityMapScreen'),
  'StrategyCapabilityMapScreen'
);
export const LazyStrategyCapabilitiesScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyCapabilitiesScreen'),
  'StrategyCapabilitiesScreen'
);
export const LazyStrategyHeatmapsScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyHeatmapsScreen'),
  'StrategyHeatmapsScreen'
);
export const LazyStrategyStrategyScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyStrategyScreen'),
  'StrategyStrategyScreen'
);
export const LazyStrategyTraceabilityScreen = lazyRouteComponent(
  () => import('../../app/strategy-model/sections/StrategyTraceabilityScreen'),
  'StrategyTraceabilityScreen'
);
export const LazyVendorOverviewScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorOverviewScreen'),
  'VendorOverviewScreen'
);
export const LazyVendorVendorsScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorVendorsScreen'),
  'VendorVendorsScreen'
);
export const LazyVendorContractsScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorContractsScreen'),
  'VendorContractsScreen'
);
export const LazyVendorSpendScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorSpendScreen'),
  'VendorSpendScreen'
);
export const LazyVendorRiskScreen = lazyRouteComponent(
  () => import('../../app/vendor-management/sections/VendorRiskScreen'),
  'VendorRiskScreen'
);
export const LazyRiskComplianceOverviewScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceOverviewScreen'),
  'RiskComplianceOverviewScreen'
);
export const LazyRiskComplianceRisksScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceRisksScreen'),
  'RiskComplianceRisksScreen'
);
export const LazyRiskComplianceControlsScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceControlsScreen'),
  'RiskComplianceControlsScreen'
);
export const LazyRiskComplianceRetentionScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceRetentionScreen'),
  'RiskComplianceRetentionScreen'
);
export const LazyRiskComplianceAssessmentsScreen = lazyRouteComponent(
  () => import('../../app/risk-compliance/sections/RiskComplianceAssessmentsScreen'),
  'RiskComplianceAssessmentsScreen'
);
export const LazyDataStewardshipMyWorkScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipMyWorkScreen'),
  'DataStewardshipMyWorkScreen'
);
export const LazyDataStewardshipStewardshipScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipStewardshipScreen'),
  'DataStewardshipStewardshipScreen'
);
export const LazyDataStewardshipClassificationScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipClassificationScreen'),
  'DataStewardshipClassificationScreen'
);
export const LazyDataStewardshipChangeCasesScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipChangeCasesScreen'),
  'DataStewardshipChangeCasesScreen'
);
export const LazyDataStewardshipAssessmentsScreen = lazyRouteComponent(
  () => import('../../app/data-stewardship/sections/DataStewardshipAssessmentsScreen'),
  'DataStewardshipAssessmentsScreen'
);
export const LazyApiIntegrationCatalogOverviewScreen = lazyRouteComponent(
  () => import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogOverviewScreen'),
  'ApiIntegrationCatalogOverviewScreen'
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
export const LazyApiIntegrationCatalogSyncScreen = lazyRouteComponent(
  () => import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogSyncScreen'),
  'ApiIntegrationCatalogSyncScreen'
);
export const LazyApiIntegrationCatalogImpactScreen = lazyRouteComponent(
  () => import('../../app/api-integration-catalog/sections/ApiIntegrationCatalogImpactScreen'),
  'ApiIntegrationCatalogImpactScreen'
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
