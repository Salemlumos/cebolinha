import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNicknameStore } from '../../src/core/nickname-store.js';

let tmpDir;

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

describe('createNicknameStore sem filePath', () => {
  it('funciona só em memória (comportamento padrão, usado em testes)', () => {
    const store = createNicknameStore();
    store.set('guild-1', 'user-1', 'Apelido');
    expect(store.get('guild-1', 'user-1')).toBe('Apelido');
  });
});

describe('createNicknameStore com filePath', () => {
  it('persiste um alias e um novo store lido do mesmo arquivo o recupera', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cebolinha-nick-'));
    const filePath = join(tmpDir, 'nicknames.json');

    const store1 = createNicknameStore(filePath);
    store1.set('guild-1', 'user-1', 'Apelido');

    const store2 = createNicknameStore(filePath);
    expect(store2.get('guild-1', 'user-1')).toBe('Apelido');
  });

  it('mantém o alias ao trocar de canal/sessão — não é limpo entre usos', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cebolinha-nick-'));
    const filePath = join(tmpDir, 'nicknames.json');

    const store1 = createNicknameStore(filePath);
    store1.set('guild-1', 'user-1', 'Apelido');
    // "reinício do bot" simulado: novo store carregando do mesmo arquivo
    const store2 = createNicknameStore(filePath);
    expect(store2.get('guild-1', 'user-1')).toBe('Apelido');
    // usado numa "nova gravação" (outro canal, mesmo guild) sem re-setar o alias
    expect(store2.get('guild-1', 'user-1')).toBe('Apelido');
  });

  it('remove um alias e a remoção também persiste', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cebolinha-nick-'));
    const filePath = join(tmpDir, 'nicknames.json');

    const store1 = createNicknameStore(filePath);
    store1.set('guild-1', 'user-1', 'Apelido');
    store1.remove('guild-1', 'user-1');

    const store2 = createNicknameStore(filePath);
    expect(store2.get('guild-1', 'user-1')).toBeUndefined();
  });

  it('não lança se o arquivo ainda não existe (primeira vez)', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cebolinha-nick-'));
    const filePath = join(tmpDir, 'ainda-nao-existe.json');
    expect(() => createNicknameStore(filePath)).not.toThrow();
  });
});
