import { TbPhoto } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { flatConfigCodec } from '../../shared/configSchema';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { ImageEmbed } from './ImageEmbed';
import { ImageEmbedConfigForm } from './ImageEmbedConfigForm';
import { imageEmbedWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'ImageEmbed',
  category: 'content-layout',
  name: 'Image',
  description: 'Embed an uploaded image attachment',
  configSchema: imageEmbedWidgetConfigSchema,
  keywords: ['image', 'photo', 'attachment', 'picture'],
  component: ImageEmbed,
  configForm: ImageEmbedConfigForm,
  icon: TbPhoto,
  mdx: configBlockMdx({
    codec: flatConfigCodec(imageEmbedWidgetConfigSchema, { attributeNames: { fileId: 'id' } }),
    placeholder: 'Choose image…',
    fullWidth: true
  })
});
