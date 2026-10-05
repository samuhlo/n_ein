package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"n_ein/internal/brand"
)

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func git(t *testing.T, project string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = project
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %s: %v", args, output, err)
	}
}

func TestFiveViewsUseObservedSources(t *testing.T) {
	root := t.TempDir()
	project := filepath.Join(root, "project")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("N_EIN_AGENT_DIR", filepath.Join(root, "pi-agent"))
	t.Setenv("N_EIN_CLAUDE_DIR", filepath.Join(root, "claude"))
	t.Setenv("N_EIN_MODELS_FILE", filepath.Join(root, "no-models.json"))
	write(t, filepath.Join(root, "runtime.json"), `{"pi":{"model":"openai-codex/gpt-6-sol","thinking":"high"},"worker":{"model":"openai-codex/gpt-6-luna","thinking":"high"}}`)
	write(t, filepath.Join(root, "brand.json"), `{"colors":{"yellow":"#FFCA40","concrete":"#FAF3F0","structure":"#737373"}}`)
	write(t, filepath.Join(project, "WORK.md"), "# Encargo\n\n## Objetivo\nCorregir el puerto.\n\n## Tareas\n- [x] Reproducir\n- [ ] Arreglar\n\n## Evidencia\nEl check pasó antes de editar.\n")
	write(t, filepath.Join(project, "code.ts"), "export const port = 0\n")
	git(t, project, "init", "-b", "main")
	git(t, project, "config", "user.name", "n_ein test")
	git(t, project, "config", "user.email", "test@n-ein.invalid")
	git(t, project, "add", ".")
	git(t, project, "commit", "-m", "test: base")

	state := loadState(root, project)
	if len(state.views) != 5 || state.views[1].title != "ESTADO" || state.views[0].title != "INICIO" {
		t.Fatalf("vistas: %#v", state.views)
	}
	rows := state.views[1].rows
	if rows[3].value != "Corregir el puerto." || rows[4].value != "1/2 hechas" || rows[5].value != "Arreglar" {
		t.Fatalf("documento de trabajo: %#v", rows)
	}
	if rows[6].value != "consignada · vigencia desconocida" {
		t.Fatalf("evidencia inventada: %s", rows[6].value)
	}
	if !strings.Contains(state.views[2].rows[0].value, "gpt-6-sol") {
		t.Fatal("la configuración no lee runtime.json")
	}
	write(t, filepath.Join(project, "code.ts"), "export const port = 1\n")
	state = loadState(root, project)
	if state.views[1].rows[2].value != "1 rutas con cambios" {
		t.Fatalf("Git sucio no detectado: %s", state.views[1].rows[2].value)
	}
	write(t, filepath.Join(project, "WORK.md"), "# Acuerdo\n\n## Acuerdo confirmado\nCopiar apuntes por fecha.\n\n## Criterios observables\nNo mover originales.\n")
	state = loadState(root, project)
	if state.views[1].rows[3].value != "Copiar apuntes por fecha." {
		t.Fatal("un acuerdo anterior debe seguir siendo legible")
	}

	write(t, filepath.Join(project, "WORK.md"), "# Work\n\n## Goal\nShip the parser.\n\n## Tasks\n- [x] T1\n- [ ] T2 · Render\n\n## Evidence\nbun test\n")
	state = loadState(root, project)
	if rows := state.views[1].rows; rows[3].value != "Ship the parser." || rows[4].value != "1/2 hechas" || rows[5].value != "T2 · Render" || rows[6].value != "consignada · vigencia desconocida" {
		t.Fatalf("WORK.md en inglés no leído: %#v", rows)
	}

	noDoc := t.TempDir()
	other := loadState(root, noDoc)
	if other.views[1].rows[3].value != "sin documento" || other.views[1].rows[6].value != "desconocida" {
		t.Fatal("sin documento debe distinguirse de evidencia vacía")
	}
	plain := render(other, 1, 0, "", false, brand.Painter{}, screen{})
	if strings.Contains(plain, "\x1b[") || !strings.Contains(plain, "desconocida") {
		t.Fatal("render sin TTY debe ser legible y monocromo")
	}
}

func TestRuntimeViewUsesConfiguredBinariesAndRejectsWrongPiVersion(t *testing.T) {
	root := t.TempDir()
	project := t.TempDir()
	t.Setenv("N_EIN_AGENT_DIR", filepath.Join(root, "pi-agent"))
	t.Setenv("N_EIN_CLAUDE_DIR", filepath.Join(root, "claude-agent"))
	t.Setenv("N_EIN_MODELS_FILE", filepath.Join(root, "no-models.json"))
	write(t, filepath.Join(root, "runtime.json"), `{"pi":{"version":"0.87.1","model":"openai-codex/gpt-6-sol","thinking":"high"},"codegraph":{"version":"1.6.1"}}`)
	pi := filepath.Join(root, "custom-pi")
	claude := filepath.Join(root, "custom-claude")
	write(t, pi, "#!/bin/sh\nprintf '0.88.0\\n'\n")
	write(t, claude, "#!/bin/sh\nprintf '2.0.0\\n'\n")
	for _, path := range []string{pi, claude} {
		if err := os.Chmod(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("N_EIN_PI_BIN", pi)
	t.Setenv("N_EIN_CLAUDE_BIN", claude)

	state := loadState(root, project)
	codegraph := filepath.Join(root, "codegraph")
	write(t, codegraph, "#!/bin/sh\nprintf '1.6.0\\n'\n")
	if err := os.Chmod(codegraph, 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("N_EIN_CODEGRAPH_BIN", codegraph)
	state = loadState(root, project)
	if row := state.views[4].rows[3]; row.label != "CodeGraph" || row.value != "requiere 1.6.1 · actual 1.6.0" {
		t.Fatalf("Sistema no distingue CodeGraph incompatible: %#v", row)
	}
	if state.views[4].rows[1].value != "0.88.0" || state.views[4].rows[2].value != "2.0.0" {
		t.Fatalf("Sistema ignoró los ejecutables configurados: %#v", state.views[4].rows)
	}
	if state.views[0].rows[0].action != "" || !strings.Contains(state.views[0].rows[0].value, "0.87.1") {
		t.Fatalf("La portada ofreció Pi incompatible: %#v", state.views[0].rows[0])
	}
	if state.views[0].rows[1].action != "claude" {
		t.Fatalf("La portada ocultó Claude configurado: %#v", state.views[0].rows[1])
	}
	write(t, pi, "#!/bin/sh\nprintf '0.87.1\\n'\n")
	state = loadState(root, project)
	if state.views[0].rows[0].action != "pi" {
		t.Fatalf("La portada no ofreció Pi compatible: %#v", state.views[0].rows[0])
	}
}

func TestConfigViewShowsModelsFromChannelData(t *testing.T) {
	root := t.TempDir()
	project := t.TempDir()
	settings := filepath.Join(root, "models.json")
	t.Setenv("N_EIN_MODELS_FILE", settings)
	t.Setenv("N_EIN_AGENT_DIR", filepath.Join(root, "pi-agent"))
	t.Setenv("N_EIN_CLAUDE_DIR", filepath.Join(root, "claude-agent"))
	write(t, filepath.Join(root, "runtime.json"), `{"schema":1,"pi":{"version":"0.87.1","model":"nein/auto","thinking":"medium"},"scout":{"model":"openai-codex/gpt-6-luna","thinking":"low"},"worker":{"model":"openai-codex/gpt-6-luna","thinking":"high"},"reviewer":{"model":"openai-codex/gpt-6-sol","thinking":"medium"},"routing":{"mecanico":{"model":"openai-codex/gpt-6-luna","thinking":"medium"},"ordinario":{"model":"openai-codex/gpt-6-sol","thinking":"medium"},"riesgo":{"model":"openai-codex/gpt-6-sol","thinking":"high"},"abierto":{"model":"openai-codex/gpt-6-sol","thinking":"high"}}}`)
	pi := filepath.Join(root, "pi")
	write(t, pi, "#!/bin/sh\nprintf '0.87.1\\n'\n")
	if err := os.Chmod(pi, 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("N_EIN_PI_BIN", pi)
	write(t, settings, `{"schema":1,"agents":{"principal":{"model":"openai-codex/gpt-6-luna","thinking":"medium"},"ordinario":{"model":"openai-codex/gpt-6-sol","thinking":"high"}}}`)

	state := loadState(root, project)
	rows := state.views[2].rows
	if rows[0].value != "openai-codex/gpt-6-luna · medium" || rows[0].source != "models.json" {
		t.Fatalf("principal efectivo: %#v", rows[0])
	}
	// Un modelo por encargo: la tabla de enrutado sustituye a los roles en la vista.
	for i, want := range []row{
		{"mecánico", "openai-codex/gpt-6-luna · medium", "runtime.json", ""},
		{"ordinario", "openai-codex/gpt-6-sol · high", "models.json", ""},
		{"riesgo", "openai-codex/gpt-6-sol · high", "runtime.json", ""},
		{"abierto", "openai-codex/gpt-6-sol · high", "runtime.json", ""},
	} {
		if rows[i+1] != want {
			t.Fatalf("clase %d: quería %#v, hay %#v", i+1, want, rows[i+1])
		}
	}
	if rows[5].label != "claude" || rows[5].value != "modelo de Claude Code · esfuerzo por defecto" || rows[5].source != "Claude Code" {
		t.Fatalf("Claude sin ajuste debe usar el esfuerzo de Claude Code: %#v", rows[5])
	}
	if rows[6].action != "pi" || state.views[0].rows[0].action != "pi" {
		t.Fatal("selector o runtime inaccesible con ajuste válido")
	}
	write(t, settings, `{"schema":1,"agents":{},"claude":{"effort":"xhigh"}}`)
	state = loadState(root, project)
	if row := state.views[2].rows[5]; row.value != "modelo de Claude Code · xhigh" || row.source != "models.json" {
		t.Fatalf("esfuerzo de Claude no leído: %#v", row)
	}
	write(t, settings, `{"schema":1,"agents":{},"claude":{"effort":"minimal"}}`)
	state = loadState(root, project)
	if !strings.Contains(state.views[2].rows[5].value, "models.json inválido: claude") {
		t.Fatalf("esfuerzo de Claude inválido aceptado: %#v", state.views[2].rows[5])
	}
	write(t, settings, `{"schema":1,"agents":{"principal":{"model":"bad model","thinking":"high"}}}`)
	state = loadState(root, project)
	if !strings.Contains(state.views[2].rows[0].value, "models.json inválido") || state.views[0].rows[0].action != "" {
		t.Fatal("ajuste inválido no debe parecer efectivo ni abrir Pi")
	}
}

func TestSessionsUseHumanPromptsFromCurrentProject(t *testing.T) {
	root := t.TempDir()
	project := filepath.Join(root, "project")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	piHome := filepath.Join(root, "pi")
	claudeHome := filepath.Join(root, "claude")
	t.Setenv("N_EIN_AGENT_DIR", piHome)
	t.Setenv("N_EIN_CLAUDE_DIR", claudeHome)
	write(t, filepath.Join(piHome, "sessions", "2026-09-29_11111111-1111-4111-8111-111111111111.jsonl"),
		`{"type":"session","cwd":"`+project+`"}`+"\n"+
			`{"type":"message","message":{"role":"user","content":[{"type":"text","text":"Arregla el puerto"}]}}`+"\n")
	write(t, filepath.Join(claudeHome, "projects", "current", "22222222-2222-4222-8222-222222222222.jsonl"),
		`{"type":"user","cwd":"`+project+`","origin":{"kind":"human"},"message":{"role":"user","content":"<command-name>/handoff-pi</command-name><command-args>Vuelve a Pi</command-args>"}}`+"\n"+
			`{"type":"user","cwd":"`+project+`","message":{"role":"user","content":[{"type":"text","text":"Base directory for this skill: /tmp/skill"}]}}`+"\n")
	write(t, filepath.Join(claudeHome, "projects", "other", "33333333-3333-4333-8333-333333333333.jsonl"),
		`{"type":"user","cwd":"/otro/proyecto","origin":{"kind":"human"},"message":{"role":"user","content":"No mostrar"}}`+"\n")

	sessions := recentSessions("dev", project)
	if len(sessions) != 2 {
		t.Fatalf("sesiones del proyecto: %#v", sessions)
	}
	foundPi, foundClaude := false, false
	for _, item := range sessions {
		switch item.runtime {
		case "Pi":
			foundPi = item.last == "Arregla el puerto" && item.id == "11111111-1111-4111-8111-111111111111"
		case "Claude":
			foundClaude = item.last == "/handoff-pi Vuelve a Pi" && item.id == "22222222-2222-4222-8222-222222222222"
		}
	}
	if !foundPi || !foundClaude {
		t.Fatalf("petición humana no recuperada: %#v", sessions)
	}
}
