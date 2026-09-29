import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits, ButtonStyle } from 'discord.js';
import {
  buildRecordingControlsRow,
  buildMuteButtonRows,
  buildCallPanelComponents,
  RECORDING_START_ID,
  RECORDING_PAUSE_ID,
  RECORDING_FINISH_ID,
  MUTE_TOGGLE_PREFIX,
} from '../../src/core/call-panel-components.js';

function makeMember({ id, displayName, muted = false, exempt = false }) {
  return {
    id,
    displayName,
    voice: { serverMute: muted },
    permissions: { has: (flag) => exempt && flag === PermissionFlagsBits.ManageGuild },
  };
}

function findButton(row, customId) {
  return row.components.find((button) => button.data.custom_id === customId).data;
}

describe('buildRecordingControlsRow', () => {
  it('estado idle: Iniciar habilitado, Pausar e Finalizar desabilitados', () => {
    const row = buildRecordingControlsRow('idle');
    expect(findButton(row, RECORDING_START_ID).disabled).toBe(false);
    expect(findButton(row, RECORDING_START_ID).label).toBe('🔴 Iniciar');
    expect(findButton(row, RECORDING_PAUSE_ID).disabled).toBe(true);
    expect(findButton(row, RECORDING_FINISH_ID).disabled).toBe(true);
  });

  it('estado recording: Iniciar desabilitado, Pausar e Finalizar habilitados', () => {
    const row = buildRecordingControlsRow('recording');
    expect(findButton(row, RECORDING_START_ID).disabled).toBe(true);
    expect(findButton(row, RECORDING_PAUSE_ID).disabled).toBe(false);
    expect(findButton(row, RECORDING_FINISH_ID).disabled).toBe(false);
  });

  it('estado paused: botão de iniciar mostra "Retomar" e fica habilitado; Finalizar também habilitado', () => {
    const row = buildRecordingControlsRow('paused');
    expect(findButton(row, RECORDING_START_ID).label).toBe('▶️ Retomar');
    expect(findButton(row, RECORDING_START_ID).disabled).toBe(false);
    expect(findButton(row, RECORDING_PAUSE_ID).disabled).toBe(true);
    expect(findButton(row, RECORDING_FINISH_ID).disabled).toBe(false);
  });

  it('estado finishing: os três botões ficam desabilitados', () => {
    const row = buildRecordingControlsRow('finishing');
    expect(findButton(row, RECORDING_START_ID).disabled).toBe(true);
    expect(findButton(row, RECORDING_PAUSE_ID).disabled).toBe(true);
    expect(findButton(row, RECORDING_FINISH_ID).disabled).toBe(true);
  });
});

describe('buildMuteButtonRows', () => {
  it('cria um botão por membro, agrupado em linhas de até 5', () => {
    const members = Array.from({ length: 7 }, (_, i) => makeMember({ id: `u${i}`, displayName: `User${i}` }));
    const rows = buildMuteButtonRows(members);

    expect(rows).toHaveLength(2);
    expect(rows[0].components).toHaveLength(5);
    expect(rows[1].components).toHaveLength(2);
  });

  it('botão de quem está mutado usa estilo Danger e ícone 🔇', () => {
    const rows = buildMuteButtonRows([makeMember({ id: 'u1', displayName: 'Alice', muted: true })]);
    const button = rows[0].components[0].data;

    expect(button.style).toBe(ButtonStyle.Danger);
    expect(button.label).toBe('🔇 Alice');
    expect(button.custom_id).toBe(`${MUTE_TOGGLE_PREFIX}:u1`);
  });

  it('botão de quem está livre usa estilo Success e ícone 🔊', () => {
    const rows = buildMuteButtonRows([makeMember({ id: 'u1', displayName: 'Alice' })]);
    expect(rows[0].components[0].data.style).toBe(ButtonStyle.Success);
    expect(rows[0].components[0].data.label).toBe('🔊 Alice');
  });

  it('botão de quem é isento (admin) fica desabilitado, estilo Secondary e ícone 🛡️', () => {
    const rows = buildMuteButtonRows([makeMember({ id: 'u1', displayName: 'Chefe', exempt: true })]);
    const button = rows[0].components[0].data;

    expect(button.disabled).toBe(true);
    expect(button.style).toBe(ButtonStyle.Secondary);
    expect(button.label).toBe('🛡️ Chefe');
  });

  it('trunca em 20 membros no máximo (deixa espaço pra linha de gravação)', () => {
    const members = Array.from({ length: 30 }, (_, i) => makeMember({ id: `u${i}`, displayName: `User${i}` }));
    const rows = buildMuteButtonRows(members);
    const totalButtons = rows.reduce((sum, row) => sum + row.components.length, 0);

    expect(totalButtons).toBe(20);
  });
});

describe('buildCallPanelComponents', () => {
  it('combina a linha de gravação com as linhas de mute, total dentro do limite de 25 componentes', () => {
    const members = Array.from({ length: 20 }, (_, i) => makeMember({ id: `u${i}`, displayName: `User${i}` }));
    const rows = buildCallPanelComponents({ sessionState: 'recording', members });

    const totalButtons = rows.reduce((sum, row) => sum + row.components.length, 0);
    expect(totalButtons).toBeLessThanOrEqual(25);
    expect(findButton(rows[0], RECORDING_PAUSE_ID).disabled).toBe(false);
  });
});
