// Mapeamento de DDD (código de área) brasileiro para cidade/estado de referência.
// Usado para personalizar a conversa do funil a partir do WhatsApp informado.

export type DddInfo = { city: string; state: string };

export const DDD_MAP: Record<string, DddInfo> = {
  "11": { city: "São Paulo", state: "SP" },
  "12": { city: "São José dos Campos", state: "SP" },
  "13": { city: "Santos", state: "SP" },
  "14": { city: "Bauru", state: "SP" },
  "15": { city: "Sorocaba", state: "SP" },
  "16": { city: "Ribeirão Preto", state: "SP" },
  "17": { city: "São José do Rio Preto", state: "SP" },
  "18": { city: "Presidente Prudente", state: "SP" },
  "19": { city: "Campinas", state: "SP" },
  "21": { city: "Rio de Janeiro", state: "RJ" },
  "22": { city: "Campos dos Goytacazes", state: "RJ" },
  "24": { city: "Volta Redonda", state: "RJ" },
  "27": { city: "Vitória", state: "ES" },
  "28": { city: "Cachoeiro de Itapemirim", state: "ES" },
  "31": { city: "Belo Horizonte", state: "MG" },
  "32": { city: "Juiz de Fora", state: "MG" },
  "33": { city: "Governador Valadares", state: "MG" },
  "34": { city: "Uberlândia", state: "MG" },
  "35": { city: "Poços de Caldas", state: "MG" },
  "37": { city: "Divinópolis", state: "MG" },
  "38": { city: "Montes Claros", state: "MG" },
  "41": { city: "Curitiba", state: "PR" },
  "42": { city: "Ponta Grossa", state: "PR" },
  "43": { city: "Londrina", state: "PR" },
  "44": { city: "Maringá", state: "PR" },
  "45": { city: "Foz do Iguaçu", state: "PR" },
  "46": { city: "Francisco Beltrão", state: "PR" },
  "47": { city: "Joinville", state: "SC" },
  "48": { city: "Florianópolis", state: "SC" },
  "49": { city: "Chapecó", state: "SC" },
  "51": { city: "Porto Alegre", state: "RS" },
  "53": { city: "Pelotas", state: "RS" },
  "54": { city: "Caxias do Sul", state: "RS" },
  "55": { city: "Santa Maria", state: "RS" },
  "61": { city: "Brasília", state: "DF" },
  "62": { city: "Goiânia", state: "GO" },
  "63": { city: "Palmas", state: "TO" },
  "64": { city: "Rio Verde", state: "GO" },
  "65": { city: "Cuiabá", state: "MT" },
  "66": { city: "Rondonópolis", state: "MT" },
  "67": { city: "Campo Grande", state: "MS" },
  "68": { city: "Rio Branco", state: "AC" },
  "69": { city: "Porto Velho", state: "RO" },
  "71": { city: "Salvador", state: "BA" },
  "73": { city: "Ilhéus", state: "BA" },
  "74": { city: "Juazeiro", state: "BA" },
  "75": { city: "Feira de Santana", state: "BA" },
  "77": { city: "Barreiras", state: "BA" },
  "79": { city: "Aracaju", state: "SE" },
  "81": { city: "Recife", state: "PE" },
  "82": { city: "Maceió", state: "AL" },
  "83": { city: "João Pessoa", state: "PB" },
  "84": { city: "Natal", state: "RN" },
  "85": { city: "Fortaleza", state: "CE" },
  "86": { city: "Teresina", state: "PI" },
  "87": { city: "Petrolina", state: "PE" },
  "88": { city: "Juazeiro do Norte", state: "CE" },
  "89": { city: "Picos", state: "PI" },
  "91": { city: "Belém", state: "PA" },
  "92": { city: "Manaus", state: "AM" },
  "93": { city: "Santarém", state: "PA" },
  "94": { city: "Marabá", state: "PA" },
  "95": { city: "Boa Vista", state: "RR" },
  "96": { city: "Macapá", state: "AP" },
  "97": { city: "Tefé", state: "AM" },
  "98": { city: "São Luís", state: "MA" },
  "99": { city: "Imperatriz", state: "MA" },
};

export function lookupDdd(ddd: string): DddInfo | null {
  return DDD_MAP[ddd] ?? null;
}

/**
 * Extrai o DDD de um número de telefone local brasileiro (DDD + número, sem DDI).
 * Não remova um possível prefixo "55": o DDD 55 (Santa Maria/RS) é válido e um
 * número como "55912345678" seria incorretamente confundido com DDI + local.
 */
export function extractDdd(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;
  return digits.slice(0, 2);
}
