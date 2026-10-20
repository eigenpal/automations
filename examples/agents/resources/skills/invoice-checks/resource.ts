import { createSkill } from '@eigenpal/automations';
import content from './SKILL.md' with { type: 'text' };
import fixture from './fixture.bin' with { type: 'bytes' };
import check from './scripts/check.py' with { type: 'text' };
export default createSkill({
  name: 'invoice-checks',
  content,
  files: { 'scripts/check.py': check, 'fixture.bin': fixture },
});
