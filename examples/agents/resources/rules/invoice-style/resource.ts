import { createRule } from '@eigenpal/automations';
import content from './README.md' with { type: 'text' };
export default createRule({ name: 'invoice-style', content });
