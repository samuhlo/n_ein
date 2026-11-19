package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPreviousInstallReadsNewestBackup(t *testing.T) {
	root := filepath.Join(t.TempDir(), "preview")
	write(t, filepath.Join(root, "install.json"), `{"version":"0.7.0-alpha.2"}`)
	if got := previousInstall(root); got != "" {
		t.Fatalf("sin backups no hay versión anterior: %q", got)
	}
	write(t, root+".backups/backup-100/install.json", `{"version":"0.6.0-alpha.1"}`)
	write(t, root+".backups/backup-200/install.json", `{"version":"0.7.0-alpha.1"}`)
	write(t, root+".backups/recovery-300/install.json", `{"version":"0.7.0-alpha.3"}`)
	write(t, root+".backups/backup-300/roto.txt", "sin install.json\n")
	if got := previousInstall(root); got != "0.7.0-alpha.1" {
		t.Fatalf("la versión anterior es el backup válido más reciente, como en el instalador: %q", got)
	}
}

func TestConfirmRestoreNeedsExplicitYes(t *testing.T) {
	for input, want := range map[string]bool{"s\n": true, "Sí\n": true, "y\n": true, "\n": false, "n\n": false, "": false} {
		var out bytes.Buffer
		if got := confirmRestore(strings.NewReader(input), &out, "0.7.0-alpha.2", "0.7.0-alpha.1"); got != want {
			t.Fatalf("respuesta %q: %v", input, got)
		}
		if text := out.String(); !strings.Contains(text, "0.7.0-alpha.2 a 0.7.0-alpha.1") || !strings.Contains(text, "sesiones") {
			t.Fatalf("la pregunta no dice qué cambia ni avisa de las sesiones: %q", text)
		}
	}
}

func TestSystemOffersPreviousVersionAndBridge(t *testing.T) {
	root := filepath.Join(t.TempDir(), "preview")
	project := t.TempDir()
	t.Setenv("N_EIN_AGENT_DIR", filepath.Join(root, "pi-agent"))
	t.Setenv("N_EIN_CLAUDE_DIR", filepath.Join(root, "claude"))
	t.Setenv("N_EIN_MODELS_FILE", filepath.Join(root, "no-models.json"))
	write(t, filepath.Join(root, "runtime.json"), `{"pi":{"version":"1.5.2","model":"nein/auto","thinking":"medium"},"claudeBridge":{"version":"0.12.0"},"codegraph":{"version":"1.6.2"}}`)
	write(t, filepath.Join(root, "install.json"), `{"version":"0.7.0-alpha.2"}`)
	find := func(state appState, label string) (row, bool) {
		for _, item := range state.views[4].rows {
			if item.label == label {
				return item, true
			}
		}
		return row{}, false
	}
	state := loadState(root, project)
	if _, ok := find(state, "versión anterior"); ok {
		t.Fatal("sin backup no se ofrece volver")
	}
	if bridge, ok := find(state, "puente"); !ok || bridge.value != "0.12.0" {
		t.Fatalf("Sistema no enseña el puente: %#v", state.views[4].rows)
	}
	if state.home.runtimes["pi"] != "1.5.2" || state.home.runtimes["claudeBridge"] != "0.12.0" {
		t.Fatalf("la portada no conoce los runtimes fijados: %v", state.home.runtimes)
	}
	write(t, root+".backups/backup-1/install.json", `{"version":"0.7.0-alpha.1"}`)
	previous, ok := find(loadState(root, project), "versión anterior")
	if !ok || previous.action != "restore" || !strings.Contains(previous.value, "0.7.0-alpha.1") {
		t.Fatalf("Sistema no ofrece volver a la versión anterior: %#v", previous)
	}
	if err := os.RemoveAll(root + ".backups"); err != nil {
		t.Fatal(err)
	}
}
