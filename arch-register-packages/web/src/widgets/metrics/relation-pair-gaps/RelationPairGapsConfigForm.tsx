import { RelationPairsSourceFields } from '../../data-views/relation-pairs-coverage/RelationPairsSourceFields';
import { RelationPairGapsWidgetConfig } from './types';

export const RelationPairGapsConfigForm = ({
  config,
  onChange
}: {
  config: RelationPairGapsWidgetConfig;
  onChange: (config: RelationPairGapsWidgetConfig) => void;
}) => <RelationPairsSourceFields config={config} onChange={onChange} />;
