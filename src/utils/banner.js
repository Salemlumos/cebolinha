// Gerado uma vez com `npx figlet "CEBOLINHA" -f Standard` e hardcoded aqui
// — sem dependência de figlet em runtime, só pra exibir no boot.
const BANNER = `
   ____ _____ ____   ___  _     ___ _   _ _   _    _
  / ___| ____| __ ) / _ \\| |   |_ _| \\ | | | | |  / \\
 | |   |  _| |  _ \\| | | | |    | ||  \\| | |_| | / _ \\
 | |___| |___| |_) | |_| | |___ | || |\\  |  _  |/ ___ \\
  \\____|_____|____/ \\___/|_____|___|_| \\_|_| |_/_/   \\_\\
`;

/**
 * Imprime a arte ASCII do nome do bot direto no stdout (não passa pelo
 * pino — é decoração de boot, não um log estruturado).
 */
export function printBanner() {
  console.log(BANNER);
}
