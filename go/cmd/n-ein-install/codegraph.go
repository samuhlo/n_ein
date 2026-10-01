package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"n_ein/internal/layout"
)

// =============================================================================
// CODEGRAPH GESTIONADO
// El índice de código es obligatorio en n_ein, así que su binario se fija como
// Pi: versión y SHA-256 en runtime.json, release oficial con su propio Node y
// copia en runtimes/codegraph/<versión>. El codegraph del sistema no se toca.
// =============================================================================

const codeGraphPackage = "@colbymchenry/codegraph"

type codeGraphPin struct {
	Version string            `json:"version"`
	SHA256  map[string]string `json:"sha256"`
}

func codeGraphFrom(source string) (codeGraphPin, error) {
	data, err := os.ReadFile(filepath.Join(source, "runtime.json"))
	if err != nil {
		return codeGraphPin{}, err
	}
	var config struct {
		CodeGraph codeGraphPin `json:"codegraph"`
	}
	if json.Unmarshal(data, &config) != nil {
		return codeGraphPin{}, fmt.Errorf("runtime.json inválido")
	}
	if _, err := layout.CodeGraphRuntime(config.CodeGraph.Version); err != nil {
		return codeGraphPin{}, err
	}
	return config.CodeGraph, nil
}

// codeGraphPlatform traduce la plataforma de n_ein al nombre del asset publicado.
func codeGraphPlatform() (key, asset string, err error) {
	switch runtime.GOOS + "-" + runtime.GOARCH {
	case "darwin-arm64":
		return "darwin-arm64", "darwin-arm64", nil
	case "linux-amd64":
		return "linux-amd64", "linux-x64", nil
	}
	return "", "", fmt.Errorf("CodeGraph sin release fijada para %s-%s", runtime.GOOS, runtime.GOARCH)
}

func inspectCodeGraphRuntime(root, expected string) error {
	info, err := os.Lstat(root)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("runtime CodeGraph no es un directorio propio: %s", root)
	}
	var marker struct {
		Package string `json:"package"`
		Version string `json:"version"`
	}
	data, err := os.ReadFile(filepath.Join(root, "runtime-install.json"))
	if err != nil || json.Unmarshal(data, &marker) != nil || marker.Package != codeGraphPackage || marker.Version != expected {
		return fmt.Errorf("marcador de CodeGraph inválido: %s", root)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, filepath.Join(root, "bin", "codegraph"), "--version")
	command.Env = append(os.Environ(), "DO_NOT_TRACK=1")
	output, err := command.Output()
	if err != nil {
		return fmt.Errorf("CodeGraph instalado no responde: %w", err)
	}
	if actual := strings.TrimSpace(string(output)); actual != expected {
		return fmt.Errorf("CodeGraph instalado no devuelve %s: observada %s", expected, actual)
	}
	return nil
}

func download(url, target string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("descarga %s: HTTP %d", url, response.StatusCode)
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(file, response.Body); err != nil {
		file.Close()
		return err
	}
	return file.Close()
}

// extractRelease vuelca el tarball quitando su carpeta raíz. Solo admite archivos y
// directorios: un enlace o una ruta con `..` podría escribir fuera del runtime.
func extractRelease(archive, destination string) error {
	file, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer file.Close()
	compressed, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer compressed.Close()
	reader := tar.NewReader(compressed)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		name := filepath.ToSlash(filepath.Clean(header.Name))
		if filepath.IsAbs(name) || name == ".." || strings.HasPrefix(name, "../") {
			return fmt.Errorf("ruta insegura en el paquete de CodeGraph: %s", header.Name)
		}
		_, rel, found := strings.Cut(name, "/")
		if !found || rel == "" {
			continue
		}
		path := filepath.Join(destination, filepath.FromSlash(rel))
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(path, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, os.FileMode(header.Mode)&0o755)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, reader); err != nil {
				out.Close()
				return err
			}
			if err := out.Close(); err != nil {
				return err
			}
		default:
			return fmt.Errorf("tipo de entrada no admitido en CodeGraph: %s", header.Name)
		}
	}
}

func fileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// [FLOW] Descarga → SHA-256 → extracción en stage → --version → sustitución con backup.
func installCodeGraphRuntime(source string, dryRun bool, output io.Writer) error {
	pin, err := codeGraphFrom(source)
	if err != nil {
		return err
	}
	key, asset, err := codeGraphPlatform()
	if err != nil {
		return err
	}
	expectedHash := pin.SHA256[key]
	if len(expectedHash) != 64 {
		return fmt.Errorf("runtime.json no fija el SHA-256 de CodeGraph para %s", key)
	}
	root, err := layout.Root()
	if err != nil {
		return err
	}
	target, err := layout.CodeGraphRuntime(pin.Version)
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
		return fmt.Errorf("runtime CodeGraph sale del hogar n_ein: %s", target)
	}
	info, statErr := os.Lstat(target)
	exists := statErr == nil
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if exists && info.Mode()&os.ModeSymlink != 0 {
		return fmt.Errorf("destino CodeGraph es un enlace simbólico: %s", target)
	}
	if exists {
		if err := inspectCodeGraphRuntime(target, pin.Version); err == nil {
			say(output, "// 000 CODEGRAPH · ya instalado · %s · %s", pin.Version, target)
			return nil
		}
		if _, err := os.Stat(filepath.Join(target, "runtime-install.json")); err != nil {
			return fmt.Errorf("destino CodeGraph existente sin marcador propio: %s", target)
		}
	}
	if dryRun {
		say(output, "// 000 PLAN · CodeGraph %s · %s · backup: %t", pin.Version, target, exists)
		return nil
	}
	parent := filepath.Dir(target)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(parent, ".codegraph-stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	base := os.Getenv("N_EIN_CODEGRAPH_RELEASES")
	if base == "" {
		base = "https://github.com/colbymchenry/codegraph/releases/download"
	}
	archive := filepath.Join(stage, "release.tar.gz")
	url := fmt.Sprintf("%s/v%s/codegraph-%s.tar.gz", strings.TrimSuffix(base, "/"), pin.Version, asset)
	if err := download(url, archive); err != nil {
		return err
	}
	if actual, err := fileSHA256(archive); err != nil || actual != expectedHash {
		return fmt.Errorf("SHA-256 de CodeGraph no coincide: esperado %s, observado %s", expectedHash, actual)
	}
	tree := filepath.Join(stage, "tree")
	if err := extractRelease(archive, tree); err != nil {
		return err
	}
	marker, err := json.MarshalIndent(map[string]string{"package": codeGraphPackage, "version": pin.Version, "sha256": expectedHash}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(tree, "runtime-install.json"), append(marker, '\n'), 0o600); err != nil {
		return err
	}
	if err := inspectCodeGraphRuntime(tree, pin.Version); err != nil {
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
	if err := os.Rename(tree, target); err != nil {
		if backup != "" {
			if rollbackErr := os.Rename(backup, target); rollbackErr != nil {
				return fmt.Errorf("CodeGraph falló: %w; rollback falló: %v", err, rollbackErr)
			}
		}
		return err
	}
	say(output, "// 000 CODEGRAPH INSTALADO · %s · %s", pin.Version, target)
	return nil
}
