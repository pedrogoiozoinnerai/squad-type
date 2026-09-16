#!/bin/bash
# Envia ao GitHub o que foi commitado, ao fim de cada turno do Claude.
#
# O push é o gatilho da Vercel: ela constrói um Preview para a branch. Produção
# (squad-type.vercel.app) continua saindo só de um merge na main — por isso a
# main está explicitamente de fora daqui.
#
# Sai calado quando não há o que fazer. Um hook que fala a cada turno vira
# ruído, e ruído é o que faz as pessoas desligarem o automatismo.

set -u

repo="$(cd "$(dirname "$0")/.." && pwd)" || exit 0
cd "$repo" || exit 0

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || exit 0
[ -n "$branch" ] && [ "$branch" != "HEAD" ] || exit 0

# A main publica direto para quem está preenchendo o funil. Um deploy de
# produção é uma decisão, não um efeito colateral de eu ter terminado de falar.
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  exit 0
fi

# Sem upstream, `git push` criaria a branch remota sem ninguém ter pedido.
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)" || exit 0
[ -n "$upstream" ] || exit 0

pendentes="$(git rev-list --count "$upstream..HEAD" 2>/dev/null || echo 0)"
[ "$pendentes" -gt 0 ] 2>/dev/null || exit 0

if saida="$(git push 2>&1)"; then
  printf '{"systemMessage":"Push automático: %s commit(s) de %s foram para o GitHub. A Vercel está construindo o Preview."}\n' \
    "$pendentes" "$branch"
else
  # As últimas linhas do erro, achatadas e com aspas escapadas para caber no JSON.
  motivo="$(printf '%s' "$saida" | tail -3 | tr '\n' ' ' | sed 's/\\/\\\\/g; s/"/\\"/g')"
  printf '{"systemMessage":"Push automático falhou em %s: %s"}\n' "$branch" "$motivo"
fi
