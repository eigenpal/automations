import { createTemplate } from '@eigenpal/automations';
import content from './summary.md' with { type: 'text' };
import document from './template.docx' with { type: 'bytes' };
export default createTemplate({
  name: 'Invoice summary',
  content,
  files: { 'template.docx': document },
});
