package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"n_ein/internal/layout"
)

const piPackage = "@earendil-works/pi-coding-agent"
const claudePackage = "@anthropic-ai/claude-code"

// npmRuntime describe un agente que n_ein instala desde npm con su propio lockfile: Pi y Claude.
type npmRuntime struct {
	name    string // clave de runtime.json y carpeta en runtimes/
	label   string // cómo se nombra en mensajes
	pkg     string
	version string
}

func (r npmRuntime) lockDir() string { return r.name + "-runtime" }

func piVersionFrom(source string) (string, error) {
	data, err := os.ReadFile(filepath.Join(source, "runtime.json"))
	if err != nil {
		return "", err
	}
	var config struct {
		Schema int `json:"schema"`
		Pi     struct {
			Version string `json:"version"`
		} `json:"pi"`
	}
	if json.Unmarshal(data, &config) != nil || config.Schema != 1 {
		return "", fmt.Errorf("runtime.json inválido")
	}
	if _, err := layout.PiRuntime(config.Pi.Version); err != nil {
		return "", err
	}
	return config.Pi.Version, nil
}

// claudeVersionFrom devuelve "" en paquetes anteriores a Claude gestionado: setup omite ese paso.
func claudeVersionFrom(source string) (string, error) {
	data, err := os.ReadFile(filepath.Join(source, "runtime.json"))
	if err != nil {
		return "", err
	}
	var config struct {
		Claude *struct {
			Version string `json:"version"`
		} `json:"claude"`
	}
	if json.Unmarshal(data, &config) != nil {
		return "", fmt.Errorf("runtime.json inválido")
	}
	if config.Claude == nil {
		return "", nil
	}
	if _, err := layout.ClaudeRuntime(config.Claude.Version); err != nil {
		return "", err
	}
	return config.Claude.Version, nil
}

func inspectPiRuntime(root, expected string) error {
	return inspectRuntime(npmRuntime{"pi", "Pi", piPackage, expected}, root)
}

func inspectRuntime(r npmRuntime, root string) error {
	info, err := os.Lstat(root)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("runtime %s no es un directorio propio: %s", r.label, root)
	}
	var marker struct {
		Package string `json:"package"`
		Version string `json:"version"`
	}
	data, err := os.ReadFile(filepath.Join(root, "runtime-install.json"))
	if err != nil || json.Unmarshal(data, &marker) != nil || marker.Package != r.pkg || marker.Version != r.version {
		return fmt.Errorf("marcador de %s inválido: %s", r.label, root)
	}
	var packageJSON struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	}
	data, err = os.ReadFile(filepath.Join(root, "global", "node_modules", filepath.FromSlash(r.pkg), "package.json"))
	if err != nil || json.Unmarshal(data, &packageJSON) != nil || packageJSON.Name != r.pkg || packageJSON.Version != r.version {
		return fmt.Errorf("paquete %s incorrecto: %s", r.label, root)
	}
	binPath := filepath.Join(root, "bin", r.name)
	canonicalRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return err
	}
	actual, err := filepath.EvalSymlinks(binPath)
	if err != nil || !inside(canonicalRoot, actual) {
		return fmt.Errorf("ejecutable %s fuera del runtime: %s", r.label, binPath)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, binPath, "--version").Output()
	if err != nil {
		return fmt.Errorf("%s instalado no devuelve %s: %w", r.label, r.version, err)
	}
	// Claude añade el nombre tras el número: "2.1.302 (Claude Code)".
	fields := strings.Fields(string(output))
	if len(fields) == 0 || fields[0] != r.version {
		return fmt.Errorf("%s instalado no devuelve %s: observada %s", r.label, r.version, strings.TrimSpace(string(output)))
	}
	return nil
}

// [FLOW] Pi se instala antes de activar n_ein y nunca comparte ~/.bun/bin/pi.
func installPiRuntime(source string, dryRun bool, output io.Writer) error {
	version, err := piVersionFrom(source)
	if err != nil {
		return err
	}
	target, err := layout.PiRuntime(version)
	if err != nil {
		return err
	}
	return installRuntime(npmRuntime{"pi", "Pi", piPackage, version}, source, target, dryRun, output)
}

// [FLOW] Claude, como Pi, tiene copia propia: el claude del sistema, si existe, no se usa ni se toca.
func installClaudeRuntime(source string, dryRun bool, output io.Writer) error {
	version, err := claudeVersionFrom(source)
	if err != nil || version == "" {
		return err
	}
	target, err := layout.ClaudeRuntime(version)
	if err != nil {
		return err
	}
	return installRuntime(npmRuntime{"claude", "Claude", claudePackage, version}, source, target, dryRun, output)
}

func installRuntime(r npmRuntime, source, target string, dryRun bool, output io.Writer) error {
	root, err := layout.Root()
	if err != nil {
		return err
	}
	actualRoot, err := resolvedPath(root)
	if err != nil {
		return err
	}
	actualTarget, err := resolvedPath(target)
	if err != nil {
		return err
	}
	if !inside(actualRoot, actualTarget) {
		return fmt.Errorf("runtime %s sale del hogar n_ein: %s", r.label, target)
	}
	info, statErr := os.Lstat(target)
	exists := statErr == nil
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if exists && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("destino %s es un enlace simbólico: %s", r.label, target)
	}
	tag := strings.ToUpper(r.name)
	if exists {
		if err := inspectRuntime(r, target); err == nil {
			say(output, "// 000 %s · ya instalado · %s · %s\n", tag, r.version, target)
			return nil
		}
		if _, err := os.Stat(filepath.Join(target, "runtime-install.json")); err != nil {
			return fmt.Errorf("destino %s existente sin marcador propio: %s", r.label, target)
		}
	}
	if dryRun {
		say(output, "// 000 PLAN · %s %s · %s · backup: %t\n", r.label, r.version, target, exists)
		return nil
	}
	bun := os.Getenv("N_EIN_BUN_BIN")
	if bun == "" {
		bun, err = exec.LookPath("bun")
		if err != nil {
			return fmt.Errorf("Bun no disponible para instalar %s: %w", r.label, err)
		}
	}
	parent := filepath.Dir(target)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(parent, "."+r.name+"-stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	// Claude trae un binario nativo de ~260 MB: el margen cubre conexiones lentas.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	// Un manifest propio evita que Bun busque el package.json de un proyecto padre.
	global := filepath.Join(stage, "global")
	if err := os.MkdirAll(global, 0700); err != nil {
		return err
	}
	// El lockfile del paquete fija también las dependencias transitivas: Pi acepta rangos ^ que
	// upstream puede romper sin cambiar la versión de Pi.
	if err := copyLock(r, source, global); err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, bun, "install", "--frozen-lockfile", "--cwd", global)
	cmd.Dir = global
	cmd.Env = append(os.Environ(),
		"BUN_INSTALL_GLOBAL_DIR="+filepath.Join(stage, "global"),
		"BUN_INSTALL_BIN="+filepath.Join(stage, "bin"),
		"BUN_INSTALL_CACHE_DIR="+filepath.Join(root, "cache", "bun"),
	)
	if data, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("instalación de %s falló: %w: %s", r.label, err, strings.TrimSpace(string(data)))
	}
	if err := os.MkdirAll(filepath.Join(stage, "bin"), 0755); err != nil {
		return err
	}
	binary := filepath.Join(stage, "bin", r.name)
	if _, err := os.Lstat(binary); os.IsNotExist(err) {
		if err := os.Symlink("../global/node_modules/.bin/"+r.name, binary); err != nil {
			return err
		}
	}
	marker, err := json.MarshalIndent(map[string]string{"package": r.pkg, "version": r.version}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(stage, "runtime-install.json"), append(marker, '\n'), 0o600); err != nil {
		return err
	}
	if err := inspectRuntime(r, stage); err != nil {
		return err
	}
	backup := ""
	if exists {
		backup, err = backupPath(target, "backup")
		if err != nil {
			return err
		}
		if err := os.Rename(target, backup); err != nil {
			return err
		}
	}
	if err := os.Rename(stage, target); err != nil {
		if backup != "" {
			if rollbackErr := os.Rename(backup, target); rollbackErr != nil {
				return fmt.Errorf("%s falló: %w; rollback falló: %v", r.label, err, rollbackErr)
			}
		}
		return err
	}
	say(output, "// 000 %s INSTALADO · %s · %s\n", tag, r.version, target)
	return nil
}

func copyLock(r npmRuntime, source, global string) error {
	data, err := os.ReadFile(filepath.Join(source, r.lockDir(), "package.json"))
	if err != nil {
		return err
	}
	var manifest struct {
		Dependencies map[string]string `json:"dependencies"`
	}
	if json.Unmarshal(data, &manifest) != nil || manifest.Dependencies[r.pkg] != r.version || len(manifest.Dependencies) != 1 {
		return fmt.Errorf("%s/package.json no fija %s %s", r.lockDir(), r.label, r.version)
	}
	if err := os.WriteFile(filepath.Join(global, "package.json"), data, 0o600); err != nil {
		return err
	}
	lock, err := os.ReadFile(filepath.Join(source, r.lockDir(), "bun.lock"))
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(global, "bun.lock"), lock, 0o600)
}
