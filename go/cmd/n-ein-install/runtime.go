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

func inspectPiRuntime(root, expected string) error {
	info, err := os.Lstat(root)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("runtime Pi no es un directorio propio: %s", root)
	}
	var marker struct {
		Package string `json:"package"`
		Version string `json:"version"`
	}
	data, err := os.ReadFile(filepath.Join(root, "runtime-install.json"))
	if err != nil || json.Unmarshal(data, &marker) != nil || marker.Package != piPackage || marker.Version != expected {
		return fmt.Errorf("marcador de Pi inválido: %s", root)
	}
	var packageJSON struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	}
	data, err = os.ReadFile(filepath.Join(root, "global", "node_modules", "@earendil-works", "pi-coding-agent", "package.json"))
	if err != nil || json.Unmarshal(data, &packageJSON) != nil || packageJSON.Name != piPackage || packageJSON.Version != expected {
		return fmt.Errorf("paquete Pi incorrecto: %s", root)
	}
	piPath := filepath.Join(root, "bin", "pi")
	canonicalRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return err
	}
	actual, err := filepath.EvalSymlinks(piPath)
	if err != nil || !inside(canonicalRoot, actual) {
		return fmt.Errorf("ejecutable Pi fuera del runtime: %s", piPath)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, piPath, "--version").Output()
	if err != nil {
		return fmt.Errorf("Pi instalado no devuelve %s: %w", expected, err)
	}
	if actual := strings.TrimSpace(string(output)); actual != expected {
		return fmt.Errorf("Pi instalado no devuelve %s: observada %s", expected, actual)
	}
	return nil
}

// [FLOW] Pi se instala antes de activar n_ein y nunca comparte ~/.bun/bin/pi.
func installPiRuntime(source string, dryRun bool, output io.Writer) error {
	version, err := piVersionFrom(source)
	if err != nil {
		return err
	}
	root, err := layout.Root()
	if err != nil {
		return err
	}
	target, err := layout.PiRuntime(version)
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
		return fmt.Errorf("runtime Pi sale del hogar n_ein: %s", target)
	}
	info, statErr := os.Lstat(target)
	exists := statErr == nil
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if exists && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("destino Pi es un enlace simbólico: %s", target)
	}
	if exists {
		if err := inspectPiRuntime(target, version); err == nil {
			fmt.Fprintf(output, "// 000 PI · ya instalado · %s · %s\n", version, target)
			return nil
		}
		if _, err := os.Stat(filepath.Join(target, "runtime-install.json")); err != nil {
			return fmt.Errorf("destino Pi existente sin marcador propio: %s", target)
		}
	}
	if dryRun {
		fmt.Fprintf(output, "// 000 PLAN · Pi %s · %s · backup: %t\n", version, target, exists)
		return nil
	}
	bun := os.Getenv("N_EIN_BUN_BIN")
	if bun == "" {
		bun, err = exec.LookPath("bun")
		if err != nil {
			return fmt.Errorf("Bun no disponible para instalar Pi: %w", err)
		}
	}
	parent := filepath.Dir(target)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(parent, ".pi-stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, bun, "install", "--global", piPackage+"@"+version)
	cmd.Dir = stage
	cmd.Env = append(os.Environ(),
		"BUN_INSTALL_GLOBAL_DIR="+filepath.Join(stage, "global"),
		"BUN_INSTALL_BIN="+filepath.Join(stage, "bin"),
		"BUN_INSTALL_CACHE_DIR="+filepath.Join(root, "cache", "bun"),
	)
	if data, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("instalación de Pi falló: %w: %s", err, strings.TrimSpace(string(data)))
	}
	marker, err := json.MarshalIndent(map[string]string{"package": piPackage, "version": version}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(stage, "runtime-install.json"), append(marker, '\n'), 0o600); err != nil {
		return err
	}
	if err := inspectPiRuntime(stage, version); err != nil {
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
				return fmt.Errorf("Pi falló: %w; rollback falló: %v", err, rollbackErr)
			}
		}
		return err
	}
	fmt.Fprintf(output, "// 000 PI INSTALADO · %s · %s\n", version, target)
	return nil
}
