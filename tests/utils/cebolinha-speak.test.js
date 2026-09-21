import { describe, it, expect } from 'vitest';
import { cebolinhaSpeak } from '../../src/utils/cebolinha-speak.js';

describe('cebolinhaSpeak', () => {
  it('troca r por l', () => {
    expect(cebolinhaSpeak('rua')).toBe('lua');
  });

  it('troca R maiúsculo por L maiúsculo', () => {
    expect(cebolinhaSpeak('Rato')).toBe('Lato');
  });

  it('troca todas as ocorrências, incluindo em clusters como "br"/"pr"', () => {
    expect(cebolinhaSpeak('brigadeiro')).toBe('bligadeilo');
  });

  it('não afeta texto sem r/R', () => {
    expect(cebolinhaSpeak('lua cheia')).toBe('lua cheia');
  });
});
