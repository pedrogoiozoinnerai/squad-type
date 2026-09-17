import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  comoTratar,
  esperaAntesDe,
  LIMITES_MS,
  TENTATIVAS,
} from "../src/lib/retentativa";

/**
 * O lead mais caro que existe é o que preencheu tudo e chegou ao clique final.
 *
 * Antes, uma piscada de rede perdia esse lead: uma chamada, oito segundos,
 * desistiu. Mas repetir tem o risco oposto — repetir a recusa errada faz a
 * pessoa esperar vinte segundos por um "não" que já era conhecido no primeiro.
 */

describe("o que vale repetir", () => {
  it("rede que não respondeu — é o caso que motivou tudo", () => {
    assert.equal(comoTratar({ semResposta: true }), "tentarDeNovo");
  });

  it("o CRM reiniciando ou o banco fechando conexão", () => {
    assert.equal(comoTratar({ status: 500 }), "tentarDeNovo");
    assert.equal(comoTratar({ status: 502 }), "tentarDeNovo");
    assert.equal(comoTratar({ status: 503 }), "tentarDeNovo");
  });

  it("limite de taxa passa, porque passa mesmo", () => {
    assert.equal(comoTratar({ status: 429 }), "tentarDeNovo");
  });
});

describe("o que NÃO vale repetir", () => {
  it("a sessão que lotou entre a escolha e o clique", () => {
    // É corrida normal. Repetir devolveria o mesmo 409 três vezes e faria o
    // lead esperar por nada, quando o certo é recarregar a lista.
    assert.equal(comoTratar({ status: 409 }), "desistir");
  });

  it("sessão que não existe", () => {
    assert.equal(comoTratar({ status: 404 }), "desistir");
  });

  it("chave errada — repetir não conserta configuração", () => {
    assert.equal(comoTratar({ status: 401 }), "desistir");
    assert.equal(comoTratar({ status: 403 }), "desistir");
  });

  it("campo faltando é erro nosso, e é o mesmo nas três tentativas", () => {
    assert.equal(comoTratar({ status: 400 }), "desistir");
  });
});

describe("o que é sucesso", () => {
  it("2xx aceita", () => {
    assert.equal(comoTratar({ status: 200 }), "aceitar");
    assert.equal(comoTratar({ status: 201 }), "aceitar");
  });
});

describe("a espera, que tem uma pessoa do outro lado", () => {
  it("a primeira tentativa não espera nada", () => {
    assert.equal(esperaAntesDe(0), 0);
  });

  it("cresce entre as tentativas", () => {
    // Bater de novo no mesmo instante piora exatamente o que se quer melhorar.
    assert.ok(esperaAntesDe(1) > 0);
    assert.ok(esperaAntesDe(2) > esperaAntesDe(1));
  });

  it("o pior caso cabe na paciência de quem está olhando o botão girar", () => {
    const limites = LIMITES_MS.slice(0, TENTATIVAS).reduce((a, b) => a + b, 0);
    const esperas = Array.from({ length: TENTATIVAS }, (_, i) => esperaAntesDe(i)).reduce(
      (a, b) => a + b,
      0,
    );
    const pior = limites + esperas;
    assert.ok(pior <= 25_000, `pior caso de ${Math.round(pior / 1000)}s`);
  });

  it("há um limite de tempo para cada tentativa", () => {
    assert.equal(LIMITES_MS.length >= TENTATIVAS, true);
    // A primeira é a mais generosa: é a que quase sempre funciona.
    assert.ok(LIMITES_MS[0] >= LIMITES_MS[1]);
  });
});
