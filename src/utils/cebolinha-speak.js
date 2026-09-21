/**
 * Aplica a marca de fala do personagem Cebolinha: troca "r"/"R" por "l"/"L"
 * (como em "rua" -> "lua"). Use só em texto estático que o bot "fala" para
 * o usuário (descrições de comando, mensagens de resposta) — nunca em
 * conteúdo dinâmico (menções, nomes de canal, nomes de arquivo), que deve
 * permanecer correto e funcional.
 * @param {string} text
 * @returns {string}
 */
export function cebolinhaSpeak(text) {
  return text.replace(/r/g, 'l').replace(/R/g, 'L');
}
