package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
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
	if len(state.views) != 5 || state.views[0].title != "ESTADO" || state.views[4].title != "RUNTIME" {
		t.Fatalf("vistas: %#v", state.views)
	}
	rows := state.views[0].rows
	if rows[3].value != "Corregir el puerto." || rows[4].value != "1/2 hechas" || rows[5].value != "Arreglar" {
		t.Fatalf("documento de trabajo: %#v", rows)
	}
	if rows[6].value != "consignada · vigencia desconocida" {
		t.Fatalf("evidencia inventada: %s", rows[6].value)
	}
	if !strings.Contains(state.views[1].rows[0].value, "gpt-6-sol") {
		t.Fatal("la configuración no lee runtime.json")
	}
	write(t, filepath.Join(project, "code.ts"), "export const port = 1\n")
	state = loadState(root, project)
	if state.views[0].rows[2].value != "1 rutas con cambios" {
		t.Fatalf("Git sucio no detectado: %s", state.views[0].rows[2].value)
	}
	write(t, filepath.Join(project, "WORK.md"), "# Acuerdo\n\n## Acuerdo confirmado\nCopiar apuntes por fecha.\n\n## Criterios observables\nNo mover originales.\n")
	state = loadState(root, project)
	if state.views[0].rows[3].value != "Copiar apuntes por fecha." {
		t.Fatal("un acuerdo anterior debe seguir siendo legible")
	}

	noDoc := t.TempDir()
	other := loadState(root, noDoc)
	if other.views[0].rows[3].value != "sin documento" || other.views[0].rows[6].value != "desconocida" {
		t.Fatal("sin documento debe distinguirse de evidencia vacía")
	}
	plain := render(other.views[0], 0, "", false, false, other.colors)
	if strings.Contains(plain, "\x1b[") || !strings.Contains(plain, "desconocida") {
		t.Fatal("render sin TTY debe ser legible y monocromo")
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
