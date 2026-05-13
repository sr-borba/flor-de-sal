# memory-log.skill — convertido para Markdown

> Arquivo `.skill` convertido para Markdown.  
> Conteúdo principal extraído de `memory-log/SKILL.md`, com os arquivos auxiliares preservados ao final.

---

---
name: memory-log
description: >
  Use this skill proactively and automatically whenever the conversation is getting long, context is about to be compressed, or a significant work session is concluding. Also trigger when the user says "salva o contexto", "registra o que fizemos", "cria um log", "resumo da sessão", "não quero perder o contexto", "anota o progresso", "memory", "checkpoint", or when Claude notices it has completed a meaningful unit of work (a skill built, a document created, a problem solved, a decision made). This skill ensures continuity across sessions by writing structured memory files to disk. Always run this skill before context gets compressed — do not wait to be asked.
---

# Memory Log

Você mantém memória persistente entre sessões criando e atualizando arquivos de log estruturados em disco. Isso garante continuidade mesmo quando o contexto do chat é comprimido ou a sessão encerra.

**Execute este skill proativamente** — não espere o usuário pedir. Sempre que perceber que:
- A conversa está longa e o contexto pode ser comprimido
- Uma unidade significativa de trabalho foi concluída
- A sessão parece estar chegando ao fim
- Uma decisão importante foi tomada

---

## Estrutura de arquivos

```
projeto/
└── .claude/
    └── memory/
        ├── SESSION_LOG.md        ← log cronológico de todas as sessões
        ├── CONTEXT.md            ← estado atual do projeto (sempre atualizado)
        ├── DECISIONS.md          ← decisões importantes tomadas
        └── sessions/
            └── YYYY-MM-DD_HH-MM.md  ← snapshot de cada sessão
```

---

## Fluxo de execução

### Passo 1 — Detectar ou criar estrutura de diretórios

```bash
mkdir -p .claude/memory/sessions
```

Se os arquivos base não existirem, crie-os com estrutura vazia.

### Passo 2 — Gerar resumo da sessão atual

Analise toda a conversa e extraia:

1. **O que foi feito** — lista objetiva de ações e entregas
2. **Decisões tomadas** — escolhas que afetam o projeto
3. **Estado atual** — onde o projeto está agora
4. **Próximos passos** — o que ficou pendente ou foi planejado
5. **Arquivos criados/modificados** — com caminhos completos
6. **Contexto técnico** — stack, padrões adotados, configurações

### Passo 3 — Escrever os arquivos

Execute nesta ordem:

1. **Snapshot da sessão** → `sessions/YYYY-MM-DD_HH-MM.md`
2. **Atualizar CONTEXT.md** → substitui o estado anterior pelo atual
3. **Append em SESSION_LOG.md** → adiciona entrada cronológica
4. **Atualizar DECISIONS.md** → se houver decisões novas

### Passo 4 — Confirmar ao usuário

Informe o que foi salvo e onde. Uma linha é suficiente.

---

## Formato dos arquivos

### `sessions/YYYY-MM-DD_HH-MM.md` — Snapshot da sessão
```markdown
# Sessão: [YYYY-MM-DD HH:MM]

## O que foi feito
- [ação concreta 1]
- [ação concreta 2]

## Arquivos criados / modificados
- `caminho/do/arquivo.ext` — [descrição]
- `caminho/do/outro.ext` — [descrição]

## Decisões tomadas
- [decisão]: [justificativa breve]

## Contexto técnico relevante
- Stack: [tecnologias, versões]
- Padrões adotados: [convenções, estruturas]
- Configurações: [variáveis, flags importantes]

## Estado ao final da sessão
[parágrafo descrevendo onde o projeto está]

## Próximos passos
- [ ] [tarefa pendente 1]
- [ ] [tarefa pendente 2]

## Notas
[qualquer contexto adicional útil para a próxima sessão]
```

---

### `CONTEXT.md` — Estado atual (sempre sobrescreve)
```markdown
# Estado atual do projeto
*Última atualização: [YYYY-MM-DD HH:MM]*

## Projeto
[Nome e descrição em 1–2 frases]

## Stack e ambiente
- [tecnologia]: [versão/detalhes]

## Estrutura de arquivos relevante
```
[árvore de diretórios simplificada]
```

## O que está funcionando
- [item]

## O que está em progresso
- [item]

## Pendências e próximos passos
- [ ] [tarefa]

## Decisões e padrões adotados
- [decisão]: [resumo]

## Contexto importante para a próxima sessão
[qualquer coisa que Claude precise saber ao retomar]
```

---

### `SESSION_LOG.md` — Log cronológico (sempre append)
```markdown
# Session Log

---

## [YYYY-MM-DD HH:MM]
**Duração estimada:** [curta/média/longa]
**Resumo:** [1–2 frases do que foi feito]
**Arquivos:** [lista rápida]
**Status:** [concluído / em progresso / bloqueado]
**→ Snapshot completo:** `sessions/YYYY-MM-DD_HH-MM.md`

---
```

---

### `DECISIONS.md` — Decisões do projeto
```markdown
# Decisões do Projeto

## [YYYY-MM-DD] — [Título da decisão]
**Contexto:** [por que a decisão foi necessária]
**Decisão:** [o que foi decidido]
**Alternativas descartadas:** [o que não foi escolhido e por quê]
**Impacto:** [o que isso afeta]

---
```

---

## Instruções para retomar sessão

No início de uma nova sessão, o usuário pode dizer:
- "retoma o contexto"
- "lê o memory log"
- "onde paramos?"
- "what's the context?"

Ao receber isso, leia `CONTEXT.md` e `SESSION_LOG.md` e apresente:
1. Estado atual do projeto (de CONTEXT.md)
2. Última sessão (última entrada de SESSION_LOG.md)
3. Próximos passos pendentes

---

## Script de execução automática

Use `scripts/save_memory.py` para automatizar a criação dos arquivos quando disponível.
Caso contrário, escreva os arquivos diretamente com as ferramentas disponíveis (bash, create_file, str_replace).

**Prioridade de execução:**
1. Se estiver no Claude Code → use bash + file tools
2. Se estiver no Claude.ai → use as ferramentas de arquivo disponíveis

---

## Regras importantes

- **Nunca perca informação** — em caso de dúvida, inclua mais contexto, não menos
- **Seja objetivo** — o log deve ser útil, não bonito; bullet points diretos
- **Caminhos absolutos** — sempre registre caminhos completos de arquivos
- **Versione decisões** — se uma decisão mudar, registre a mudança em DECISIONS.md sem apagar a anterior
- **Atualize CONTEXT.md a cada sessão** — é o arquivo mais importante; deve sempre refletir o estado real


---

# Arquivos auxiliares incluídos na skill

## `memory-log/scripts/claude-md-snippet.md`

````markdown
# Integração da skill memory-log no CLAUDE.md

Adicione este bloco ao seu `CLAUDE.md` na raiz do projeto para ativar a memória automática.

---

## Bloco a adicionar no CLAUDE.md do seu projeto:

```markdown
## Memória de Sessão

Você mantém memória persistente entre sessões usando a skill `memory-log`.

### Ao iniciar uma sessão
Se existir `.claude/memory/CONTEXT.md`, leia-o silenciosamente antes de responder.
Se o usuário disser "retoma o contexto", "onde paramos" ou similar, execute:
```bash
python .claude/memory/scripts/save_memory.py --read
```

### Durante a sessão
Monitore o comprimento da conversa. Quando perceber que:
- A conversa está longa (mais de 20 trocas)
- Uma unidade de trabalho foi concluída
- O usuário sinaliza encerramento

Execute automaticamente o salvamento de memória.

### Ao encerrar ou comprimir contexto
Execute o script de memória ANTES de qualquer compressão:

```bash
python .claude/memory/scripts/save_memory.py \
  --summary "RESUMO_DO_QUE_FOI_FEITO" \
  --files "arquivo1.ext,arquivo2.ext" \
  --decisions "decisao1,decisao2" \
  --next "proximo_passo1,proximo_passo2" \
  --status "em progresso"
```

Ou, se preferir fazer manualmente com controle total:
```bash
python .claude/memory/scripts/save_memory.py --interactive
```

### Localização dos arquivos de memória
- `.claude/memory/CONTEXT.md` — estado atual (leia isso ao retomar)
- `.claude/memory/SESSION_LOG.md` — histórico cronológico
- `.claude/memory/DECISIONS.md` — decisões do projeto
- `.claude/memory/sessions/` — snapshots completos por sessão
```

---

## Comandos úteis para o usuário

Adicione estes aliases ao seu shell para facilitar:

```bash
# ~/.bashrc ou ~/.zshrc

# Salvar memória interativamente
alias claude-save="python .claude/memory/scripts/save_memory.py --interactive"

# Ler contexto atual
alias claude-ctx="python .claude/memory/scripts/save_memory.py --read"

# Listar sessões salvas
alias claude-sessions="ls -la .claude/memory/sessions/"
```

---

## Fluxo recomendado

```
INÍCIO DE SESSÃO
      │
      ▼
Claude lê CONTEXT.md automaticamente
      │
      ▼
Trabalho da sessão...
      │
      ▼
Contexto ficando longo?
      │
      ├── SIM ──► Claude salva memória → continua trabalhando
      │
      └── NÃO ──► Continua...
            │
            ▼
      Sessão encerra
            │
            ▼
      Claude salva memória final
            │
            ▼
      PRÓXIMA SESSÃO: Claude lê CONTEXT.md e retoma
```

````

---

## `memory-log/scripts/save_memory.py`

```python
#!/usr/bin/env python3
"""
save_memory.py — Script de memória persistente para sessões Claude Code

Uso:
  python save_memory.py --summary "resumo" --files "f1,f2" --decisions "d1" --next "p1,p2"
  python save_memory.py --interactive
  python save_memory.py --read

Exemplos:
  # Salvar sessão com argumentos
  python .claude/memory/scripts/save_memory.py \
    --summary "Criadas 3 skills: SEO, Brand Identity, Landing Page" \
    --files ".claude/memory/sessions/2025-01-15_14-30.md" \
    --next "Criar Copywriting Framework,Testar skills no Claude Code"

  # Ler contexto atual
  python .claude/memory/scripts/save_memory.py --read
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path


# ─── Configuração ───────────────────────────────────────────────────────────

MEMORY_DIR = Path(".claude/memory")
SESSIONS_DIR = MEMORY_DIR / "sessions"
SESSION_LOG = MEMORY_DIR / "SESSION_LOG.md"
CONTEXT_FILE = MEMORY_DIR / "CONTEXT.md"
DECISIONS_FILE = MEMORY_DIR / "DECISIONS.md"


# ─── Setup ──────────────────────────────────────────────────────────────────

def ensure_structure():
    """Cria estrutura de diretórios e arquivos base se não existirem."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

    if not SESSION_LOG.exists():
        SESSION_LOG.write_text("# Session Log\n\n")

    if not CONTEXT_FILE.exists():
        CONTEXT_FILE.write_text(
            "# Estado atual do projeto\n"
            "*Nenhuma sessão registrada ainda.*\n"
        )

    if not DECISIONS_FILE.exists():
        DECISIONS_FILE.write_text("# Decisões do Projeto\n\n")


# ─── Leitura ─────────────────────────────────────────────────────────────────

def read_context():
    """Exibe o contexto atual para retomar a sessão."""
    ensure_structure()

    print("\n" + "═" * 60)
    print("  CONTEXTO ATUAL DO PROJETO")
    print("═" * 60)

    if CONTEXT_FILE.exists():
        print(CONTEXT_FILE.read_text())
    else:
        print("Nenhum contexto salvo ainda.")

    print("\n" + "─" * 60)
    print("  ÚLTIMAS SESSÕES")
    print("─" * 60)

    if SESSION_LOG.exists():
        content = SESSION_LOG.read_text()
        # Mostra as últimas 3 entradas
        entries = content.split("---")
        recent = [e.strip() for e in entries if e.strip() and e.strip() != "# Session Log"]
        for entry in recent[-3:]:
            print(entry)
            print("─" * 40)
    else:
        print("Nenhuma sessão registrada ainda.")

    print("═" * 60 + "\n")


# ─── Escrita ──────────────────────────────────────────────────────────────────

def save_session(
    summary: str,
    files: list[str] = None,
    decisions: list[str] = None,
    next_steps: list[str] = None,
    technical_context: str = "",
    notes: str = "",
    status: str = "concluído"
):
    """Salva o snapshot da sessão e atualiza todos os arquivos de memória."""
    ensure_structure()

    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d %H:%M")
    filename_ts = now.strftime("%Y-%m-%d_%H-%M")
    session_file = SESSIONS_DIR / f"{filename_ts}.md"

    files = files or []
    decisions = decisions or []
    next_steps = next_steps or []

    # ── 1. Snapshot da sessão ─────────────────────────────────────────────
    files_md = "\n".join(f"- `{f}`" for f in files) if files else "- *(nenhum arquivo registrado)*"
    decisions_md = "\n".join(f"- {d}" for d in decisions) if decisions else "- *(nenhuma decisão registrada)*"
    next_md = "\n".join(f"- [ ] {n}" for n in next_steps) if next_steps else "- [ ] *(sem próximos passos definidos)*"

    snapshot = f"""# Sessão: {timestamp}

## O que foi feito
{summary}

## Arquivos criados / modificados
{files_md}

## Decisões tomadas
{decisions_md}

## Contexto técnico relevante
{technical_context if technical_context else "*(não registrado)*"}

## Próximos passos
{next_md}

## Notas
{notes if notes else "*(sem notas adicionais)*"}
"""
    session_file.write_text(snapshot)
    print(f"✅ Snapshot salvo: {session_file}")

    # ── 2. Atualiza SESSION_LOG.md ────────────────────────────────────────
    files_inline = ", ".join(f"`{f}`" for f in files[:3]) if files else "*(nenhum)*"
    if len(files) > 3:
        files_inline += f" +{len(files) - 3} mais"

    log_entry = f"""
---

## {timestamp}
**Resumo:** {summary[:120]}{"..." if len(summary) > 120 else ""}
**Arquivos:** {files_inline}
**Status:** {status}
**→ Snapshot completo:** `sessions/{filename_ts}.md`
"""
    with open(SESSION_LOG, "a") as f:
        f.write(log_entry)
    print(f"✅ SESSION_LOG.md atualizado")

    # ── 3. Atualiza CONTEXT.md ────────────────────────────────────────────
    context_content = f"""# Estado atual do projeto
*Última atualização: {timestamp}*

## Resumo da última sessão
{summary}

## Arquivos recentes
{files_md}

## Pendências e próximos passos
{next_md}

## Decisões em vigor
{decisions_md}

## Contexto técnico
{technical_context if technical_context else "*(não registrado)*"}

## Notas para próxima sessão
{notes if notes else "*(sem notas)*"}
"""
    CONTEXT_FILE.write_text(context_content)
    print(f"✅ CONTEXT.md atualizado")

    # ── 4. Atualiza DECISIONS.md (se houver decisões novas) ──────────────
    if decisions:
        decision_entries = ""
        for d in decisions:
            decision_entries += f"\n## {now.strftime('%Y-%m-%d')} — {d}\n**Sessão:** {timestamp}\n\n---\n"

        with open(DECISIONS_FILE, "a") as f:
            f.write(decision_entries)
        print(f"✅ DECISIONS.md atualizado com {len(decisions)} decisão(ões)")

    print(f"\n🧠 Memória salva com sucesso — {timestamp}")
    return str(session_file)


# ─── Modo interativo ──────────────────────────────────────────────────────────

def interactive_mode():
    """Coleta informações da sessão interativamente."""
    print("\n" + "═" * 60)
    print("  SALVAR MEMÓRIA DA SESSÃO")
    print("═" * 60)

    summary = input("\n📋 Resumo do que foi feito (obrigatório):\n> ").strip()
    if not summary:
        print("❌ Resumo é obrigatório.")
        sys.exit(1)

    print("\n📁 Arquivos criados/modificados (um por linha, Enter em branco para terminar):")
    files = []
    while True:
        f = input("  > ").strip()
        if not f:
            break
        files.append(f)

    print("\n🎯 Decisões tomadas (uma por linha, Enter em branco para terminar):")
    decisions = []
    while True:
        d = input("  > ").strip()
        if not d:
            break
        decisions.append(d)

    print("\n⏭️  Próximos passos (um por linha, Enter em branco para terminar):")
    next_steps = []
    while True:
        n = input("  > ").strip()
        if not n:
            break
        next_steps.append(n)

    technical = input("\n⚙️  Contexto técnico (stack, versões, configs — Enter para pular):\n> ").strip()
    notes = input("\n📝 Notas adicionais (Enter para pular):\n> ").strip()

    statuses = ["concluído", "em progresso", "bloqueado"]
    print(f"\n🚦 Status da sessão {[f'({i+1}) {s}' for i, s in enumerate(statuses)]}:")
    status_input = input("> ").strip()
    try:
        status = statuses[int(status_input) - 1]
    except (ValueError, IndexError):
        status = "concluído"

    save_session(
        summary=summary,
        files=files,
        decisions=decisions,
        next_steps=next_steps,
        technical_context=technical,
        notes=notes,
        status=status
    )


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Salva memória persistente de sessões Claude Code"
    )
    parser.add_argument("--read", action="store_true", help="Lê e exibe o contexto atual")
    parser.add_argument("--interactive", "-i", action="store_true", help="Modo interativo")
    parser.add_argument("--summary", "-s", type=str, help="Resumo da sessão")
    parser.add_argument("--files", "-f", type=str, help="Arquivos criados/modificados (separados por vírgula)")
    parser.add_argument("--decisions", "-d", type=str, help="Decisões tomadas (separadas por vírgula)")
    parser.add_argument("--next", "-n", type=str, help="Próximos passos (separados por vírgula)")
    parser.add_argument("--technical", "-t", type=str, default="", help="Contexto técnico")
    parser.add_argument("--notes", type=str, default="", help="Notas adicionais")
    parser.add_argument("--status", type=str, default="concluído", help="Status: concluído/em progresso/bloqueado")

    args = parser.parse_args()

    if args.read:
        read_context()
        return

    if args.interactive:
        interactive_mode()
        return

    if args.summary:
        files = [f.strip() for f in args.files.split(",")] if args.files else []
        decisions = [d.strip() for d in args.decisions.split(",")] if args.decisions else []
        next_steps = [n.strip() for n in args.next.split(",")] if args.next else []

        save_session(
            summary=args.summary,
            files=files,
            decisions=decisions,
            next_steps=next_steps,
            technical_context=args.technical,
            notes=args.notes,
            status=args.status
        )
        return

    # Default: modo interativo se nenhum argumento
    interactive_mode()


if __name__ == "__main__":
    main()

```
