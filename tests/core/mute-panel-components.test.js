import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits, ButtonStyle } from 'discord.js';
import { buildMutePanelComponents, MUTE_TOGGLE_PREFIX } from '../../src/core/mute-panel-components.js';

function makeMember({ id, displayName, muted = false, exempt = false }) {
  return {
    id,
    displayName,
    voice: { serverMute: muted },
    permissions: { has: (flag) => exempt && flag === PermissionFlagsBits.ManageGuild },
  };
}

function flattenButtons(rows) {
  return rows.flatMap((row) => row.components.map((button) => button.data));
}

describe('buildMutePanelComponents', () => {
  it('cria um botão por membro, agrupado em linhas de até 5', () => {
    const members = Array.from({ length: 7 }, (_, i) => makeMember({ id: `u${i}`, displayName: `User${i}` }));
    const rows = buildMutePanelComponents(members);

    expect(rows).toHaveLength(2);
    expect(rows[0].components).toHaveLength(5);
    expect(rows[1].components).toHaveLength(2);
  });

  it('botão de quem está mutado usa estilo Danger e ícone 🔇', () => {
    const rows = buildMutePanelComponents([makeMember({ id: 'u1', displayName: 'Alice', muted: true })]);
    const [button] = flattenButtons(rows);

    expect(button.style).toBe(ButtonStyle.Danger);
    expect(button.label).toBe('🔇 Alice');
    expect(button.custom_id).toBe(`${MUTE_TOGGLE_PREFIX}:u1`);
  });

  it('botão de quem está livre usa estilo Success e ícone 🔊', () => {
    const rows = buildMutePanelComponents([makeMember({ id: 'u1', displayName: 'Alice', muted: false })]);
    const [button] = flattenButtons(rows);

    expect(button.style).toBe(ButtonStyle.Success);
    expect(button.label).toBe('🔊 Alice');
  });

  it('botão de quem é isento (admin) fica desabilitado, estilo Secondary e ícone 🛡️', () => {
    const rows = buildMutePanelComponents([makeMember({ id: 'u1', displayName: 'Chefe', exempt: true })]);
    const [button] = flattenButtons(rows);

    expect(button.disabled).toBe(true);
    expect(button.style).toBe(ButtonStyle.Secondary);
    expect(button.label).toBe('🛡️ Chefe');
  });

  it('trunca em 25 membros no máximo (limite do Discord)', () => {
    const members = Array.from({ length: 30 }, (_, i) => makeMember({ id: `u${i}`, displayName: `User${i}` }));
    const rows = buildMutePanelComponents(members);
    const totalButtons = rows.reduce((sum, row) => sum + row.components.length, 0);

    expect(totalButtons).toBe(25);
  });
});
