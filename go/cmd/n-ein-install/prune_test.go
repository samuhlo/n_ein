package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPruneKeepsCurrentAndPreviousRuntimes(t *testing.T) {
	home := t.TempDir()
	pins := func(pi, claude, bridge, codegraph string) string {
		return `{"schema":1,"pi":{"version":"` + pi + `"},"claude":{"version":"` + claude + `"},"claudeBridge":{"version":"` + bridge + `"},"codegraph":{"version":"` + codegraph + `"},"node":{"version":"24.21.0"},"bun":{"version":"1.3.14"}}`
	}
	installation := func(dir, runtime string) {
		writeFixture(t, dir, ".n-ein-channel", "preview\n", 0o644)
		writeFixture(t, dir, "install.json", `{"version":"x"}`, 0o644)
		writeFixture(t, dir, "runtime.json", runtime, 0o644)
	}
	installations := filepath.Join(home, "installations")
	installation(filepath.Join(installations, "preview"), pins("1.5.2", "2.1.311", "0.12.0", "1.6.2"))
	backups := filepath.Join(installations, "preview.backups")
	installation(filepath.Join(backups, "backup-500"), pins("1.0.2", "2.1.302", "0.9.3", "1.6.1"))
	for _, name := range []string{"backup-400", "backup-300", "backup-200", "recovery-100", "recovery-050"} {
		installation(filepath.Join(backups, name), pins("0.87.1", "2.1.200", "0.9.0", "1.5.0"))
	}
	writeFixture(t, backups, "backup-100/ajeno.txt", "sin marcador de instalación\n", 0o644)
	runtimes := filepath.Join(home, "runtimes")
	for _, rel := range []string{"pi/0.87.1", "pi/1.0.2", "pi/1.5.2", "claude/2.1.200", "claude/2.1.302", "claude/2.1.311", "claude-bridge/0.9.3", "claude-bridge/0.12.0", "codegraph/1.6.1", "codegraph/1.6.2"} {
		writeFixture(t, runtimes, rel+"/runtime-install.json", "{}\n", 0o600)
	}
	writeFixture(t, runtimes, "node/24.21.0/dependency.json", "{}\n", 0o600)
	writeFixture(t, runtimes, "node/22.0.0/dependency.json", "{}\n", 0o600)
	writeFixture(t, runtimes, "bun/1.3.14/dependency.json", "{}\n", 0o600)
	writeFixture(t, runtimes, "pi/0.87.1.backups/backup-1/runtime-install.json", "{}\n", 0o600)
	writeFixture(t, runtimes, "pi/0.50.0/bin/pi", "sin marcador: no es de n_ein\n", 0o755)

	removedRuntimes, removedCopies, err := prune(home)
	if err != nil {
		t.Fatal(err)
	}
	if removedRuntimes != 3 || removedCopies != 2 {
		t.Fatalf("limpieza: %d runtimes, %d backups", removedRuntimes, removedCopies)
	}
	exists := func(path string) bool { _, err := os.Stat(path); return err == nil }
	for _, kept := range []string{"pi/1.5.2", "pi/1.0.2", "claude/2.1.311", "claude/2.1.302", "claude-bridge/0.12.0", "claude-bridge/0.9.3", "codegraph/1.6.2", "codegraph/1.6.1", "node/24.21.0", "bun/1.3.14", "pi/0.50.0"} {
		if !exists(filepath.Join(runtimes, kept)) {
			t.Fatalf("borró %s, que usa la instalación, su backup más reciente o no es de n_ein", kept)
		}
	}
	for _, gone := range []string{"pi/0.87.1", "pi/0.87.1.backups", "claude/2.1.200", "node/22.0.0"} {
		if exists(filepath.Join(runtimes, gone)) {
			t.Fatalf("conservó %s sin uso", gone)
		}
	}
	for name, kept := range map[string]bool{"backup-500": true, "backup-400": true, "backup-300": true, "backup-200": false, "recovery-100": true, "recovery-050": false, "backup-100": true} {
		if exists(filepath.Join(backups, name)) != kept {
			t.Fatalf("backup %s: se esperaba conservado=%t", name, kept)
		}
	}
	if again, copies, err := prune(home); err != nil || again != 0 || copies != 0 {
		t.Fatalf("una segunda limpieza volvió a borrar: %d %d %v", again, copies, err)
	}

	bare := t.TempDir()
	writeFixture(t, bare, "runtimes/pi/1.0.2/runtime-install.json", "{}\n", 0o600)
	if _, _, err := prune(bare); err == nil || !exists(filepath.Join(bare, "runtimes/pi/1.0.2")) {
		t.Fatalf("sin instalaciones no se sabe qué está en uso: no se borra nada: %v", err)
	}
}
