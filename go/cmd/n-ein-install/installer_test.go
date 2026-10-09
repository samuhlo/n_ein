package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
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

// fakeCodeGraphRelease sirve un tarball con la forma del oficial y devuelve su clave de plataforma y SHA-256.
func fakeCodeGraphRelease(t *testing.T, version string) (key, hash string) {
	t.Helper()
	key, asset, err := codeGraphPlatform()
	if err != nil {
		t.Skip(err)
	}
	var archive bytes.Buffer
	compressed := gzip.NewWriter(&archive)
	tarball := tar.NewWriter(compressed)
	top := "codegraph-" + asset + "/"
	script := "#!/bin/sh\nprintf '" + version + "\\n'\n"
	for _, entry := range []struct {
		name string
		body string
	}{{top, ""}, {top + "bin/", ""}, {top + "bin/codegraph", script}, {top + "node", "#!/bin/sh\n"}} {
		header := &tar.Header{Name: entry.name, Mode: 0o755, ModTime: time.Unix(0, 0), Typeflag: tar.TypeDir}
		if !strings.HasSuffix(entry.name, "/") {
			header.Typeflag, header.Size = tar.TypeReg, int64(len(entry.body))
		}
		if err := tarball.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := tarball.Write([]byte(entry.body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tarball.Close(); err != nil {
		t.Fatal(err)
	}
	if err := compressed.Close(); err != nil {
		t.Fatal(err)
	}
	body := archive.Bytes()
	sum := sha256.Sum256(body)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v"+version+"/codegraph-"+asset+".tar.gz" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(body)
	}))
	t.Cleanup(server.Close)
	t.Setenv("N_EIN_CODEGRAPH_RELEASES", server.URL)
	return key, hex.EncodeToString(sum[:])
}

func sourceFixture(t *testing.T) (source, self, target, data string) {
	t.Helper()
	root := t.TempDir()
	source = filepath.Join(root, "source")
	target = filepath.Join(root, "installations", "preview")
	data = filepath.Join(root, "user-data")
	self = writeFixture(t, root, "self-binary", "installer", 0o755)
	writeFixture(t, source, "dist/n-ein", "launcher", 0o755)
	for _, rel := range []string{"bin/nein", "bin/nein-setup", "bin/n-ein-dev", "bin/n-ein-claude-dev", "bin/n-ein-prepare-pi", "bin/n-ein-codegraph", "bin/n-ein-todo"} {
		writeFixture(t, source, rel, "#!/bin/sh\nexit 0\n", 0o755)
	}
	writeFixture(t, source, "brand.json", `{"colors":{"yellow":"#FFCA40"}}`, 0o644)
	key, hash := fakeCodeGraphRelease(t, "1.6.1")
	writeFixture(t, source, "runtime.json", fmt.Sprintf(`{"schema":1,"pi":{"version":"0.87.1","model":"openai-codex/gpt-6-sol","thinking":"high"},"worker":{"model":"openai-codex/gpt-6-luna","thinking":"high"},"codegraph":{"version":"1.6.1","sha256":{%q:%q}}}`, key, hash), 0o644)
	writeFixture(t, source, "pi-package/package.json", `{"name":"n-ein-pi"}`, 0o644)
	writeFixture(t, source, "pi-package/persona.md", "persona v1\n", 0o644)
	writeFixture(t, source, "pi-package/pi-only.md", "Pi worker\n", 0o644)
	writeFixture(t, source, "pi-package/flow.md", "flujo\n", 0o644)
	writeFixture(t, source, "pi-package/models.ts", "export const model = 'test'\n", 0o644)
	writeFixture(t, source, "pi-package/lang.ts", "export const lang = 'test'\n", 0o644)
	writeFixture(t, source, "pi-package/memory.ts", "export const memory = 'test'\n", 0o644)
	writeFixture(t, source, "pi-package/router.ts", "export const router = 'test'\n", 0o644)
	writeFixture(t, source, "pi-package/NOTICE.md", "avisos\n", 0o644)
	writeFixture(t, source, "pi-package/agents/summary.ts", "export const marker = true\n", 0o644)
	writeFixture(t, source, "pi-package/extensions/agents.ts", "export default () => {}\n", 0o644)
	writeFixture(t, source, "pi-package/themes/ein.json", `{"name":"ein"}`, 0o644)
	writeFixture(t, source, "pi-package/claude-plugin/.claude-plugin/plugin.json", `{"name":"n-ein"}`, 0o644)
	writeFixture(t, source, "pi-package/claude-plugin/.claude-plugin/types/claude-code/index.d.ts", "// generado\n", 0o644)
	writeFixture(t, source, "pi-package/claude-plugin/hooks/register.tsx", "export const register = () => {}\n", 0o644)
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

func TestWorkerRuntimeIsPackaged(t *testing.T) {
	source, self, target, _ := sourceFixture(t)
	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(target, "pi-package/agents/summary.ts"))
	if err != nil || string(content) != "export const marker = true\n" {
		t.Fatalf("worker dependency missing: %s %v", content, err)
	}
}

func TestClaudePluginIsPackagedWithoutGeneratedTypes(t *testing.T) {
	source, self, target, _ := sourceFixture(t)
	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(target, "pi-package/claude-plugin/hooks/register.tsx")); err != nil {
		t.Fatalf("plugin de Claude ausente: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, "pi-package/claude-plugin/.claude-plugin/types")); !os.IsNotExist(err) {
		t.Fatalf("los tipos generados no deben empaquetarse: %v", err)
	}
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

func TestInstallDoesNotReplaceUnmanagedTarget(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	for _, verb := range []string{"install", "update"} {
		for _, dryRun := range []bool{false, true} {
			target := filepath.Join(t.TempDir(), "unmanaged")
			writeFixture(t, target, "important.txt", "conservar\n", 0o600)
			args := []string{verb, "--source", source, "--target", target}
			if dryRun {
				args = append(args, "--dry-run")
			}
			if _, err := call(t, self, args...); err == nil {
				t.Fatalf("%s aceptó destino ajeno (dry-run=%t)", verb, dryRun)
			}
			if data, err := os.ReadFile(filepath.Join(target, "important.txt")); err != nil || string(data) != "conservar\n" {
				t.Fatalf("%s alteró destino ajeno: %q %v", verb, data, err)
			}
			if _, err := os.Stat(target + ".backups"); !os.IsNotExist(err) {
				t.Fatalf("%s creó backup de destino ajeno: %v", verb, err)
			}
		}
	}

	target := filepath.Join(t.TempDir(), "managed")
	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	writeFixture(t, target, "pi-package/persona.md", "dañado\n", 0o644)
	if _, err := call(t, self, "update", "--source", source, "--target", target); err != nil {
		t.Fatalf("update debe poder reparar una instalación identificada: %v", err)
	}
	if _, err := call(t, self, "doctor", "--target", target); err != nil {
		t.Fatalf("update no reparó la instalación: %v", err)
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

func TestDoctorRuntimeSeparatesPackageAndDependencies(t *testing.T) {
	source, self, target, _ := sourceFixture(t)
	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	bin := t.TempDir()
	pi := writeFixture(t, bin, "pi", "#!/bin/sh\nprintf '0.87.1\\n'\n", 0o755)
	writeFixture(t, bin, "bun", "#!/bin/sh\nexit 0\n", 0o755)
	t.Setenv("PATH", bin)
	t.Setenv("N_EIN_PI_BIN", pi)
	codegraph := writeFixture(t, bin, "codegraph", "#!/bin/sh\nprintf '1.6.1\\n'\n", 0o755)
	t.Setenv("N_EIN_CODEGRAPH_BIN", codegraph)
	if output, err := call(t, self, "doctor", "--target", target, "--runtime"); err != nil || !strings.Contains(output, "Pi 0.87.1") || !strings.Contains(output, "CODEGRAPH · 1.6.1") {
		t.Fatalf("doctor de runtime: %s %v", output, err)
	}
	writeFixture(t, bin, "codegraph", "#!/bin/sh\nprintf '1.5.0\\n'\n", 0o755)
	if _, err := call(t, self, "doctor", "--target", target, "--runtime"); err == nil || !strings.Contains(err.Error(), "CodeGraph incompatible") {
		t.Fatalf("doctor aceptó CodeGraph incompatible: %v", err)
	}
	if err := os.Remove(codegraph); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "doctor", "--target", target, "--runtime"); err == nil || !strings.Contains(err.Error(), "CodeGraph no disponible") {
		t.Fatalf("doctor aceptó CodeGraph ausente: %v", err)
	}
	writeFixture(t, bin, "codegraph", "#!/bin/sh\nprintf '1.6.1\\n'\n", 0o755)
	writeFixture(t, bin, "pi", "#!/bin/sh\nprintf '0.88.0\\n'\n", 0o755)
	if _, err := call(t, self, "doctor", "--target", target, "--runtime"); err == nil || !strings.Contains(err.Error(), "0.87.1") {
		t.Fatalf("doctor aceptó Pi incompatible: %v", err)
	}
	if _, err := call(t, self, "doctor", "--target", target); err != nil {
		t.Fatalf("la integridad del paquete no depende de Pi: %v", err)
	}
	if err := os.Remove(pi); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "doctor", "--target", target, "--runtime"); err == nil || !strings.Contains(err.Error(), "Pi no disponible") {
		t.Fatalf("doctor aceptó Pi ausente: %v", err)
	}
	writeFixture(t, bin, "pi", "#!/bin/sh\nprintf '0.87.1\\n'\n", 0o755)
	if err := os.Remove(filepath.Join(bin, "bun")); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "doctor", "--target", target, "--runtime"); err == nil || !strings.Contains(err.Error(), "Bun") {
		t.Fatalf("doctor aceptó Bun ausente: %v", err)
	}
}

const fakeBunScript = `#!/bin/sh
set -eu
package="$BUN_INSTALL_GLOBAL_DIR/node_modules/@earendil-works/pi-coding-agent"
mkdir -p "$BUN_INSTALL_BIN" "$package/dist/bundle"
printf '{"name":"@earendil-works/pi-coding-agent","version":"0.87.1"}\n' > "$package/package.json"
printf '#!/bin/sh\nprintf "0.87.1\\n"\n' > "$package/dist/bundle/cli.js"
chmod +x "$package/dist/bundle/cli.js"
ln -s ../global/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js "$BUN_INSTALL_BIN/pi"
`

func TestManagedPiRuntimeIsolatedAndRepairable(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	home := filepath.Join(t.TempDir(), "n_ein")
	t.Setenv("N_EIN_HOME", home)
	t.Setenv("N_EIN_BUN_BIN", writeFixture(t, t.TempDir(), "bun", fakeBunScript, 0o755))
	target := filepath.Join(home, "runtimes", "pi", "0.87.1")
	if _, err := call(t, self, "runtime", "--source", source, "--dry-run"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("runtime dry-run creó Pi: %v", err)
	}
	if _, err := call(t, self, "runtime", "--source", source); err != nil {
		t.Fatal(err)
	}
	if err := inspectPiRuntime(target, "0.87.1"); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "runtime", "--source", source); err != nil {
		t.Fatalf("instalación idempotente: %v", err)
	}
	writeFixture(t, target, "global/node_modules/@earendil-works/pi-coding-agent/package.json", `{"name":"@earendil-works/pi-coding-agent","version":"0.88.0"}`, 0o644)
	if _, err := call(t, self, "runtime", "--source", source); err != nil {
		t.Fatalf("reparación de Pi gestionado: %v", err)
	}
	if err := inspectPiRuntime(target, "0.87.1"); err != nil {
		t.Fatal(err)
	}
	backups, err := os.ReadDir(target + ".backups")
	if err != nil || len(backups) != 1 {
		t.Fatalf("Pi anterior no quedó respaldado: %v %#v", err, backups)
	}
	if err := inspectCodeGraphRuntime(filepath.Join(home, "runtimes", "codegraph", "1.6.1"), "1.6.1"); err != nil {
		t.Fatalf("runtime no dejó CodeGraph verificado: %v", err)
	}
}

func TestCodeGraphRuntimeRejectsWrongHash(t *testing.T) {
	source, _, _, _ := sourceFixture(t)
	home := filepath.Join(t.TempDir(), "n_ein")
	t.Setenv("N_EIN_HOME", home)
	key, _ := fakeCodeGraphRelease(t, "1.6.1")
	writeFixture(t, source, "runtime.json", fmt.Sprintf(`{"schema":1,"pi":{"version":"0.87.1"},"codegraph":{"version":"1.6.1","sha256":{%q:%q}}}`, key, strings.Repeat("0", 64)), 0o644)
	var output bytes.Buffer
	if err := installCodeGraphRuntime(source, false, &output); err == nil || !strings.Contains(err.Error(), "SHA-256") {
		t.Fatalf("CodeGraph aceptó un paquete con otro hash: %v", err)
	}
	if _, err := os.Stat(filepath.Join(home, "runtimes", "codegraph", "1.6.1")); !os.IsNotExist(err) {
		t.Fatalf("un paquete rechazado dejó runtime: %v", err)
	}
}

func TestExtractReleaseRejectsLinksAndEscapes(t *testing.T) {
	for name, header := range map[string]*tar.Header{
		"enlace": {Name: "top/bin/codegraph", Typeflag: tar.TypeSymlink, Linkname: "/bin/sh"},
		"escape": {Name: "top/../../fuera", Typeflag: tar.TypeReg, Mode: 0o644},
	} {
		var archive bytes.Buffer
		compressed := gzip.NewWriter(&archive)
		tarball := tar.NewWriter(compressed)
		if err := tarball.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		tarball.Close()
		compressed.Close()
		path := writeFixture(t, t.TempDir(), "release.tar.gz", archive.String(), 0o600)
		destination := filepath.Join(t.TempDir(), "tree")
		if err := extractRelease(path, destination); err == nil {
			t.Fatalf("%s aceptado por la extracción", name)
		}
	}
}

func TestManagedPiRuntimeRejectsRedirectedParent(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	home := filepath.Join(t.TempDir(), "n_ein")
	outside := t.TempDir()
	if err := os.MkdirAll(home, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(home, "runtimes")); err != nil {
		t.Fatal(err)
	}
	t.Setenv("N_EIN_HOME", home)
	if _, err := call(t, self, "runtime", "--source", source); err == nil || !strings.Contains(err.Error(), "sale del hogar") {
		t.Fatalf("runtime Pi aceptó redirección externa: %v", err)
	}
	if entries, err := os.ReadDir(outside); err != nil || len(entries) != 0 {
		t.Fatalf("runtime Pi escribió fuera del hogar: %v %#v", err, entries)
	}
}

func TestSetupInstallsEverythingOnceFromPackage(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	artifact := filepath.Join(filepath.Dir(source), "candidate")
	if _, err := call(t, self, "package", "--source", source, "--output", artifact); err != nil {
		t.Fatal(err)
	}
	home := filepath.Join(t.TempDir(), "n_ein")
	links := filepath.Join(t.TempDir(), "local-bin")
	t.Setenv("N_EIN_HOME", home)
	t.Setenv("N_EIN_LINK_DIR", links)
	t.Setenv("N_EIN_PI_BIN", "")
	t.Setenv("N_EIN_BUN_BIN", writeFixture(t, t.TempDir(), "bun", fakeBunScript, 0o755))

	plan, err := call(t, self, "setup", "--source", artifact, "--dry-run")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(home); !os.IsNotExist(err) || !strings.Contains(plan, "// 000  PLAN") || !strings.Contains(plan, "se activará tras instalar") || strings.Contains(plan, "✓") {
		t.Fatalf("setup --dry-run mutó o no explicó el plan: %v\n%s", err, plan)
	}
	first, err := call(t, self, "setup", "--source", artifact)
	if err != nil {
		t.Fatalf("%v\n%s", err, first)
	}
	for _, want := range []string{"// 000  INSTALAR", "✓ pi", "✓ código", "✓ entrada", "✓ doctor", "instalador · preview", "listo."} {
		if !strings.Contains(first, want) {
			t.Fatalf("falta %q en la salida:\n%s", want, first)
		}
	}
	if !strings.Contains(first, "PATH") {
		t.Fatal("setup did not explain the missing PATH entry")
	}
	if strings.Contains(first, "\x1b[") {
		t.Fatal("setup sin TTY emitió ANSI")
	}
	if value, err := os.Readlink(filepath.Join(links, "nein")); err != nil || value != filepath.Join(home, "bin", "nein") {
		t.Fatalf("enlace nein: %s %v", value, err)
	}
	again, err := call(t, self, "setup", "--source", artifact)
	if err != nil || strings.Count(again, "ya instalado") != 3 {
		t.Fatalf("setup repetido reinstaló: %v\n%s", err, again)
	}
	if _, err := os.Stat(filepath.Join(home, "installations", "preview.backups")); !os.IsNotExist(err) {
		t.Fatalf("setup repetido creó backup: %v", err)
	}
}

func TestActivateNeinLinksOnlyManagedInstallation(t *testing.T) {
	source, self, target, _ := sourceFixture(t)
	home := filepath.Dir(source)
	linkDir := filepath.Join(home, "entry")
	t.Setenv("N_EIN_HOME", home)
	t.Setenv("N_EIN_LINK_DIR", linkDir)
	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	if _, err := call(t, self, "activate", "--target", target, "--dry-run"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Lstat(filepath.Join(linkDir, "nein")); !os.IsNotExist(err) {
		t.Fatalf("activate dry-run creó enlace: %v", err)
	}
	if _, err := call(t, self, "activate", "--target", target); err != nil {
		t.Fatal(err)
	}
	internal := filepath.Join(home, "bin", "nein")
	if value, err := os.Readlink(internal); err != nil || value != filepath.Join(target, "bin", "nein") {
		t.Fatalf("enlace interno: %s %v", value, err)
	}
	if value, err := os.Readlink(filepath.Join(linkDir, "nein")); err != nil || value != internal {
		t.Fatalf("enlace PATH: %s %v", value, err)
	}
	if _, err := call(t, self, "activate", "--target", target); err != nil {
		t.Fatalf("activate repetido: %v", err)
	}
	if _, err := call(t, self, "activate", "--target", target, "--channel", "stable"); err == nil {
		t.Fatal("activate aceptó otro canal")
	}
}

func TestActivateNeinRejectsUnrelatedEntry(t *testing.T) {
	source, self, target, _ := sourceFixture(t)
	home := filepath.Dir(source)
	linkDir := filepath.Join(home, "entry")
	t.Setenv("N_EIN_HOME", home)
	t.Setenv("N_EIN_LINK_DIR", linkDir)
	if _, err := call(t, self, "install", "--source", source, "--target", target); err != nil {
		t.Fatal(err)
	}
	writeFixture(t, linkDir, "nein", "original\n", 0o600)
	if _, err := call(t, self, "activate", "--target", target); err == nil {
		t.Fatal("activate sustituyó una entrada ajena")
	}
	if data, err := os.ReadFile(filepath.Join(linkDir, "nein")); err != nil || string(data) != "original\n" {
		t.Fatalf("entrada ajena alterada: %q %v", data, err)
	}
	if _, err := os.Lstat(filepath.Join(home, "bin", "nein")); !os.IsNotExist(err) {
		t.Fatalf("activate dejó enlace parcial: %v", err)
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
