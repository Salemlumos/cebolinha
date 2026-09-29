import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { isMuteExempt } from '../../src/core/mute-exempt.js';

function makeMember(hasManageGuild) {
  return { permissions: { has: (flag) => hasManageGuild && flag === PermissionFlagsBits.ManageGuild } };
}

describe('isMuteExempt', () => {
  it('é isento quem tem Manage Server', () => {
    expect(isMuteExempt(makeMember(true))).toBe(true);
  });

  it('não é isento quem não tem Manage Server', () => {
    expect(isMuteExempt(makeMember(false))).toBe(false);
  });
});
