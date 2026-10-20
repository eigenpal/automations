import { createKnowledge } from '@eigenpal/automations';
import content from './README.md' with { type: 'text' };
export default createKnowledge({ name: 'tax-policy', content });
