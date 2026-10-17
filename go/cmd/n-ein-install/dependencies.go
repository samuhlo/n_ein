package main

// =============================================================================
// [FLOW] DEPENDENCIAS PROPIAS
// Node ejecuta Pi; Bun ejecuta las utilidades TS. Se conservan por versión en el
// hogar, con descarga verificada y sustitución recuperable, sin tocar el sistema.
// =============================================================================

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"n_ein/internal/layout"
	"n_ein/internal/release"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type dependencyAsset struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	Member string `json:"member"`
	Format string `json:"format"`
}
type dependencyPin struct {
	Version string                     `json:"version"`
	Assets  map[string]dependencyAsset `json:"assets"`
}
type dependencyMarker struct{ Version, ArchiveSHA256, BinarySHA256 string }

func dependencyPins(source string) (map[string]dependencyPin, error) {
	data, err := os.ReadFile(filepath.Join(source, "runtime.json"))
	if err != nil {
		return nil, err
	}
	var config map[string]json.RawMessage
	if err = json.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	pins := map[string]dependencyPin{}
	for _, name := range []string{"node", "bun"} {
		if raw, ok := config[name]; ok {
			var p dependencyPin
			if err = json.Unmarshal(raw, &p); err != nil {
				return nil, err
			}
			v, e := release.Parse(p.Version)
			if e != nil || v.Pre != "" || v.Build != "" {
				return nil, fmt.Errorf("versión de %s inválida", name)
			}
			pins[name] = p
		}
	}
	return pins, nil
}
func dependencyValid(target, name string, pin dependencyPin, asset dependencyAsset) bool {
	var marker dependencyMarker
	data, err := os.ReadFile(filepath.Join(target, "dependency.json"))
	if err != nil || json.Unmarshal(data, &marker) != nil {
		return false
	}
	if marker.Version != pin.Version || marker.ArchiveSHA256 != asset.SHA256 {
		return false
	}
	binary := filepath.Join(target, "bin", name)
	info, err := os.Lstat(binary)
	if err != nil || !info.Mode().IsRegular() {
		return false
	}
	hash, err := fileSHA256(binary)
	if err != nil || hash != marker.BinarySHA256 {
		return false
	}
	return dependencyVersion(binary, pin.Version) == nil
}
func dependencyVersion(binary, version string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	b, err := exec.CommandContext(ctx, binary, "--version").Output()
	if err != nil || strings.TrimPrefix(strings.TrimSpace(string(b)), "v") != version {
		return fmt.Errorf("%s no devuelve la versión %s: %v", filepath.Base(binary), version, err)
	}
	return nil
}

// Solo se extrae el ejecutable declarado; no se siguen enlaces ni rutas del archivo.
func extractDependency(archive, destination string, asset dependencyAsset) error {
	write := func(reader io.Reader) error {
		out, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0755)
		if err != nil {
			return err
		}
		defer out.Close()
		n, err := io.Copy(out, io.LimitReader(reader, 512<<20))
		if n >= 512<<20 {
			return fmt.Errorf("ejecutable demasiado grande")
		}
		return err
	}
	if asset.Format == "zip" {
		z, err := zip.OpenReader(archive)
		if err != nil {
			return err
		}
		defer z.Close()
		for _, f := range z.File {
			if f.Name == asset.Member {
				if !f.Mode().IsRegular() {
					return fmt.Errorf("ejecutable no regular")
				}
				r, err := f.Open()
				if err != nil {
					return err
				}
				defer r.Close()
				return write(r)
			}
		}
	} else if asset.Format == "tar.gz" {
		f, err := os.Open(archive)
		if err != nil {
			return err
		}
		defer f.Close()
		gz, err := gzip.NewReader(f)
		if err != nil {
			return err
		}
		defer gz.Close()
		tr := tar.NewReader(gz)
		for {
			h, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				return err
			}
			if h.Name == asset.Member {
				if h.Typeflag != tar.TypeReg {
					return fmt.Errorf("ejecutable no regular")
				}
				return write(tr)
			}
		}
	} else {
		return fmt.Errorf("formato no soportado: %s", asset.Format)
	}
	return fmt.Errorf("el archivo no contiene %s", asset.Member)
}
func installDependencies(source string, dry bool, output io.Writer) error {
	pins, err := dependencyPins(source)
	if err != nil {
		return err
	}
	root, err := layout.Root()
	if err != nil {
		return err
	}
	for _, name := range []string{"node", "bun"} {
		pin, ok := pins[name]
		if !ok {
			continue
		} // Los paquetes antiguos y fixtures conservan su contrato.
		asset, ok := pin.Assets[runtime.GOOS+"-"+runtime.GOARCH]
		if !ok || len(asset.SHA256) != 64 {
			return fmt.Errorf("%s sin descarga fijada para esta plataforma", name)
		}
		target := filepath.Join(root, "runtimes", name, pin.Version)
		actualRoot, err := resolvedPath(root)
		if err != nil {
			return err
		}
		actual, err := resolvedPath(target)
		if err != nil {
			return err
		}
		if !inside(actualRoot, actual) {
			return fmt.Errorf("%s sale del hogar", name)
		}
		info, err := os.Lstat(target)
		exists := err == nil
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if exists {
			if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				return fmt.Errorf("destino %s no es directorio propio", name)
			}
			if dependencyValid(target, name, pin, asset) {
				say(output, "// 000 DEP · %s %s · ya instalado\n", name, pin.Version)
				continue
			}
			if _, err := os.Stat(filepath.Join(target, "dependency.json")); err != nil {
				return fmt.Errorf("destino %s sin marcador propio", name)
			}
		}
		if dry {
			say(output, "// 000 PLAN · %s %s · %s\n", name, pin.Version, target)
			continue
		}
		if err := installDependency(target, name, pin, asset, exists); err != nil {
			return err
		}
		say(output, "// 000 DEP · %s %s · instalado\n", name, pin.Version)
	}
	return nil
}
func installDependency(target, name string, pin dependencyPin, asset dependencyAsset, exists bool) error {
	parent := filepath.Dir(target)
	if err := os.MkdirAll(parent, 0700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(parent, ".dependency-stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	archive := filepath.Join(stage, "download")
	if err := download(asset.URL, archive); err != nil {
		return err
	}
	sum, err := fileSHA256(archive)
	if err != nil || sum != asset.SHA256 {
		return fmt.Errorf("checksum de %s incorrecto", name)
	}
	if err := os.Mkdir(filepath.Join(stage, "bin"), 0755); err != nil {
		return err
	}
	binary := filepath.Join(stage, "bin", name)
	if err := extractDependency(archive, binary, asset); err != nil {
		return err
	}
	if err := dependencyVersion(binary, pin.Version); err != nil {
		return err
	}
	hash, err := fileSHA256(binary)
	if err != nil {
		return err
	}
	marker, _ := json.Marshal(dependencyMarker{pin.Version, asset.SHA256, hash})
	if err := os.WriteFile(filepath.Join(stage, "dependency.json"), marker, 0600); err != nil {
		return err
	}
	if err := os.Remove(archive); err != nil {
		return err
	}
	backup := ""
	if exists {
		backup, err = backupPath(target, "backup")
		if err != nil {
			return err
		}
		if err = os.Rename(target, backup); err != nil {
			return err
		}
	}
	if err = os.Rename(stage, target); err != nil {
		if backup != "" {
			if rollback := os.Rename(backup, target); rollback != nil {
				return fmt.Errorf("%w; restore: %v", err, rollback)
			}
		}
		return err
	}
	return nil
}

// Las dependencias del sistema se explican antes de mutar el hogar; no se instala con sudo.
func systemTools() error {
	var missing []string
	for _, name := range []string{"git", "rg"} {
		if _, err := exec.LookPath(name); err != nil {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("faltan herramientas: %s; instala Git y ripgrep (Ubuntu: apt install git ripgrep; Arch: pacman -S git ripgrep; macOS: brew install git ripgrep)", strings.Join(missing, ", "))
	}
	return nil
}
