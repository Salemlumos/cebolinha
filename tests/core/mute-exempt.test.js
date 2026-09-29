import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { isMuteExempt } from '../../src/core/mute-exempt.js';

function makeMember({ hasAdministrator = false, hasManageGuild = false } = {}) {
  return {
    permissions: {
      has: (flag) =>
        (hasAdministrator && flag === PermissionFlagsBits.Administrator) ||
        (hasManageGuild && flag === PermissionFlagsBits.ManageGuild),
    },
  };
}

describe('isMuteExempt', () => {
  it('é isento quem tem Administrator', () => {
    expect(isMuteExempt(makeMember({ hasAdministrator: true }))).toBe(true);
  });

  it('não é isento quem só tem Manage Server (sem Administrator)', () => {
    expect(isMuteExempt(makeMember({ hasManageGuild: true }))).toBe(false);
  });

  it('não é isento quem não tem nenhuma das duas', () => {
    expect(isMuteExempt(makeMember())).toBe(false);
  });
});
