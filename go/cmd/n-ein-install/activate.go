package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"n_ein/internal/layout"
)

func linkStatus(path, expected string) (bool, error) {
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if info.Mode()&os.ModeSymlink == 0 {
		return false, fmt.Errorf("entrada existente no gestionada: %s", path)
	}
	actual, err := os.Readlink(path)
	if err != nil {
		return false, err
	}
	if actual != expected {
		return false, fmt.Errorf("enlace existente apunta a otro destino: %s → %s", path, actual)
	}
	return true, nil
}

// [FLOW] El comando en PATH es solo un enlace; binarios y datos quedan en n_ein.
func activateLauncher(target, channel string, dryRun bool, output io.Writer) error {
	meta, err := validate(target)
	if err != nil {
		return err
	}
	if meta.Channel != channel {
		return fmt.Errorf("canal instalado %s no coincide con %s", meta.Channel, channel)
	}
	root, err := layout.Root()
	if err != nil {
		return err
	}
	expected, err := layout.Installation(channel)
	if err != nil {
		return err
	}
	actualTarget, err := resolvedPath(target)
	if err != nil {
		return err
	}
	actualExpected, err := resolvedPath(expected)
	if err != nil {
		return err
	}
	if actualTarget != actualExpected {
		return fmt.Errorf("activar requiere instalación del canal en %s", expected)
	}
	entry := filepath.Join(target, "bin", "nein")
	if info, err := os.Stat(entry); err != nil || !info.Mode().IsRegular() || info.Mode().Perm()&0o111 == 0 {
		return fmt.Errorf("launcher nein no disponible: %s", entry)
	}
	internal := filepath.Join(root, "bin", "nein")
	actualRoot, err := resolvedPath(root)
	if err != nil {
		return err
	}
	actualInternal, err := resolvedPath(internal)
	if err != nil || !inside(actualRoot, actualInternal) {
		return fmt.Errorf("enlace interno sale del hogar n_ein: %s", internal)
	}
	linkDir := os.Getenv("N_EIN_LINK_DIR")
	if linkDir == "" {
		linkDir = filepath.Join(filepath.Dir(root), ".local", "bin")
	}
	external := filepath.Join(linkDir, "nein")
	internalReady, err := linkStatus(internal, entry)
	if err != nil {
		return err
	}
	externalReady, err := linkStatus(external, internal)
	if err != nil {
		return err
	}
	if dryRun {
		fmt.Fprintf(output, "// 000 PLAN · nein · %s → %s → %s\n", external, internal, entry)
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(internal), 0o700); err != nil {
		return err
	}
	if err := os.MkdirAll(linkDir, 0o755); err != nil {
		return err
	}
	createdInternal := false
	if !internalReady {
		if err := os.Symlink(entry, internal); err != nil {
			return err
		}
		createdInternal = true
	}
	if !externalReady {
		if err := os.Symlink(internal, external); err != nil {
			if createdInternal {
				_ = os.Remove(internal)
			}
			return err
		}
	}
	fmt.Fprintf(output, "// 000 ACTIVADO · nein · %s\n", external)
	return nil
}
