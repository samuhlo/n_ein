package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFixture(t *testing.T, root, rel, content string, mode os.FileMode) string {
	t.Helper()
	path := filepath.Join(root, rel)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatal(err)
	}
	return path
}

func sourceFixture(t *testing.T) (source, self, target, data string) {
	t.Helper()
	root := t.TempDir()
	source = filepath.Join(root, "source")
	target = filepath.Join(root, "installations", "preview")
	data = filepath.Join(root, "user-data")
	self = writeFixture(t, root, "self-binary", "installer", 0o755)
	writeFixture(t, source, "dist/n-ein", "launcher", 0o755)
	for _, rel := range []string{"bin/n-ein-dev", "bin/n-ein-claude-dev", "bin/n-ein-prepare-pi"} {
		writeFixture(t, source, rel, "#!/bin/sh\nexit 0\n", 0o755)
	}
	writeFixture(t, source, "brand.json", `{"colors":{"yellow":"#FFCA40"}}`, 0o644)
	writeFixture(t, source, "runtime.json", `{"schema":1,"pi":{"version":"0.87.1","model":"openai-codex/gpt-6-sol","thinking":"high"},"worker":{"model":"openai-codex/gpt-6-luna","thinking":"high"}}`, 0o644)
	writeFixture(t, source, "pi-package/package.json", `{"name":"n-ein-pi"}`, 0o644)
	writeFixture(t, source, "pi-package/persona.md", "persona v1\n", 0o644)
	writeFixture(t, source, "pi-package/pi-only.md", "Pi worker\n", 0o644)
	writeFixture(t, source, "pi-package/extensions/worker.ts", "export default () => {}\n", 0o644)
	writeFixture(t, source, "pi-package/themes/ein.json", `{"name":"ein"}`, 0o644)
	writeFixture(t, source, "pi-package/skills/intent/SKILL.md", "# Intent\n", 0o644)
	writeFixture(t, source, "pi-package/skills/synced/foreign.txt", "generated cache\n", 0o644)
	writeFixture(t, data, "auth.json", "private auth\n", 0o600)
	writeFixture(t, data, "sessions/keep.jsonl", "session\n", 0o600)
	return
}

func call(t *testing.T, self string, args ...string) (string, error) {
	t.Helper()
	var output bytes.Buffer
	err := run(args, &output, self)
	return output.String(), err
}

func TestInstallerLifecycle(t *testing.T) {
	source, self, target, data := sourceFixture(t)
	if _, err := call(t, self, "install", "--source", source, "--target", target, "--dry-run"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("dry-run creó destino: %v", err)
	}
	if _, err := os.Stat(target + ".backups"); !os.IsNotExist(err) {
		t.Fatalf("dry-run creó backups: %v", err)
	}

	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	if output, err := call(t, self, "doctor", "--target", target); err != nil || !strings.Contains(output, "preview") {
		t.Fatalf("doctor: %s %v", output, err)
	}
	if _, err := os.Stat(filepath.Join(target, "pi-package/skills/synced")); !os.IsNotExist(err) {
		t.Fatalf("se empaquetó la caché ajena: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, "bin/n-ein-install")); err != nil {
		t.Fatal(err)
	}

	writeFixture(t, source, "pi-package/persona.md", "persona v2\n", 0o644)
	if _, err := call(t, self, "update", "--source", source, "--target", target, "--channel", "stable"); err != nil {
		t.Fatal(err)
	}
	if channel, err := os.ReadFile(filepath.Join(target, ".n-ein-channel")); err != nil || string(channel) != "stable\n" {
		t.Fatalf("canal tras update: %q %v", channel, err)
	}
	if _, err := call(t, self, "doctor", "--target", target); err != nil {
		t.Fatal(err)
	}

	if err := os.Remove(filepath.Join(source, "bin/n-ein-dev")); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "update", "--source", source, "--target", target, "--channel", "preview"); err == nil {
		t.Fatal("update inválido debía fallar")
	}
	if channel, _ := os.ReadFile(filepath.Join(target, ".n-ein-channel")); string(channel) != "stable\n" {
		t.Fatalf("un update fallido cambió el canal: %q", channel)
	}

	if _, err := call(t, self, "restore", "--target", target, "--dry-run"); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "restore", "--target", target); err != nil {
		t.Fatal(err)
	}
	if channel, _ := os.ReadFile(filepath.Join(target, ".n-ein-channel")); string(channel) != "preview\n" {
		t.Fatalf("restore no recuperó canal: %q", channel)
	}
	if persona, _ := os.ReadFile(filepath.Join(target, "pi-package/persona.md")); string(persona) != "persona v1\n" {
		t.Fatalf("restore no recuperó contenido: %q", persona)
	}

	writeFixture(t, target, "pi-package/persona.md", "corrupted\n", 0o644)
	if _, err := call(t, self, "doctor", "--target", target); err == nil {
		t.Fatal("doctor aceptó un archivo alterado")
	}
	if _, err := call(t, self, "uninstall", "--target", target, "--dry-run"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); err != nil {
		t.Fatal("dry-run de uninstall quitó el destino")
	}
	if _, err := call(t, self, "uninstall", "--target", target); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("uninstall dejó destino activo: %v", err)
	}
	if _, err := call(t, self, "restore", "--target", target); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "doctor", "--target", target); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{"auth.json", "sessions/keep.jsonl"} {
		if _, err := os.Stat(filepath.Join(data, rel)); err != nil {
			t.Fatalf("dato privado perdido: %s: %v", rel, err)
		}
	}
}

func TestProtectedTargets(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	for _, target := range []string{
		home,
		filepath.Join(home, ".pi-ein", "agent"),
		filepath.Join(home, ".n_ein", "dev", "pi-agent"),
		filepath.Join(home, ".n_ein", "installations"),
	} {
		if _, err := call(t, self, "install", "--source", source, "--target", target, "--dry-run"); err == nil {
			t.Fatalf("aceptó destino protegido: %s", target)
		}
	}
	alias := filepath.Join(t.TempDir(), "alias")
	if err := os.Symlink(filepath.Join(home, ".pi-ein"), alias); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "install", "--source", source, "--target", filepath.Join(alias, "agent"), "--dry-run"); err == nil {
		t.Fatal("aceptó alias hacia Ein legado")
	}
	for _, target := range []string{filepath.Join(source, "installed"), filepath.Dir(source)} {
		if _, err := call(t, self, "install", "--source", source, "--target", target, "--dry-run"); err == nil {
			t.Fatalf("aceptó solapamiento de fuente y destino: %s", target)
		}
	}
}

func TestProtectedTargetsWithSymlinkedHome(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "real-home")
	if err := os.Mkdir(home, 0o755); err != nil {
		t.Fatal(err)
	}
	alias := filepath.Join(root, "home-link")
	if err := os.Symlink(home, alias); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOME", alias)
	for _, target := range []string{home, filepath.Join(home, ".pi-ein", "agent"), filepath.Join(home, ".n_ein", "installations")} {
		if err := protectTarget(target); err == nil {
			t.Fatalf("aceptó destino protegido con HOME enlazado: %s", target)
		}
	}
}

func TestArtifactPromotionAndTamperDetection(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	root := filepath.Dir(source)
	artifact := filepath.Join(root, "candidate")
	preview := filepath.Join(root, "installations", "preview")
	stable := filepath.Join(root, "installations", "stable")
	if _, err := call(t, self, "package", "--source", source, "--output", artifact, "--dry-run"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(artifact); !os.IsNotExist(err) {
		t.Fatal("package --dry-run creó archivos")
	}
	if _, err := call(t, self, "package", "--source", source, "--output", artifact); err != nil {
		t.Fatal(err)
	}
	if _, err := validateArtifact(artifact); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(artifact, "pi-package/skills/synced")); !os.IsNotExist(err) {
		t.Fatal("el paquete incluyó la caché de Claude")
	}
	otherInstaller := writeFixture(t, root, "other-installer", "different binary", 0o755)
	if _, err := call(t, otherInstaller, "install", "--source", artifact, "--target", preview, "--channel", "preview"); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, otherInstaller, "install", "--source", artifact, "--target", stable, "--channel", "stable"); err != nil {
		t.Fatal(err)
	}
	for _, target := range []string{preview, stable} {
		if _, err := call(t, self, "doctor", "--target", target); err != nil {
			t.Fatal(err)
		}
		actual, err := os.ReadFile(filepath.Join(target, "bin/n-ein-install"))
		if err != nil || string(actual) != "installer" {
			t.Fatalf("no se promovió el instalador del artefacto: %q %v", actual, err)
		}
	}
	first, _ := os.ReadFile(filepath.Join(preview, "package-manifest.json"))
	second, _ := os.ReadFile(filepath.Join(stable, "package-manifest.json"))
	if !bytes.Equal(first, second) {
		t.Fatal("preview y stable no recibieron los mismos bytes de paquete")
	}

	writeFixture(t, artifact, "pi-package/persona.md", "tampered", 0o644)
	if _, err := call(t, self, "update", "--source", artifact, "--target", stable, "--channel", "preview"); err == nil {
		t.Fatal("update aceptó un artefacto alterado")
	}
	if channel, _ := os.ReadFile(filepath.Join(stable, ".n-ein-channel")); string(channel) != "stable\n" {
		t.Fatal("update fallido cambió el canal")
	}
	if _, err := call(t, self, "doctor", "--target", stable); err != nil {
		t.Fatal(err)
	}
}
