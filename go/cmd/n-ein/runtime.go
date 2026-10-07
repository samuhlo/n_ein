// =============================================================================
// [FLOW] UN RUNTIME POR ÁRBOL
// El launcher conserva el bloqueo durante el recorrido Pi↔Claude. El sistema
// operativo lo libera al cerrar el descriptor, incluso si muere el launcher.
// No se borra el archivo: recrearlo permitiría bloquear inodos distintos.
// =============================================================================
package main

import (
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func acquireProjectLease(project string) (*os.File, error) {
	gitDir, err := exec.Command("git", "-C", project, "rev-parse", "--absolute-git-dir").Output()
	if err != nil {
		return acquireDirectoryLease(project)
	}
	return acquireLeaseAt(strings.TrimSpace(string(gitDir)), project)
}

// Un lector conserva identidad propia aunque su carpeta viva dentro de un repo.
func acquireDirectoryLease(directory string) (*os.File, error) {
	canonical, err := filepath.EvalSymlinks(directory)
	if err != nil {
		return nil, err
	}
	key := sha256.Sum256([]byte(canonical))
	return acquireLeaseAt(filepath.Join(os.TempDir(), "n-ein-runtime-locks", fmt.Sprintf("%x", key)), directory)
}

func acquireLeaseAt(dir, project string) (*os.File, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	lease, err := os.OpenFile(filepath.Join(dir, "n_ein-runtime.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(lease.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = lease.Close()
		if err == syscall.EWOULDBLOCK {
			return nil, fmt.Errorf("RUNTIME_BUSY: ya hay una sesión de n_ein en este árbol; ciérrala o usa su relevo: %s", project)
		}
		return nil, fmt.Errorf("bloqueo del runtime: %w", err)
	}
	return lease, nil
}

func launchRuntime(packageRoot, project, runtime string, args []string) error {
	name := "n-ein-dev"
	if runtime == "claude" {
		name = "n-ein-claude-dev"
	} else if runtime != "pi" {
		return fmt.Errorf("runtime desconocido: %s", runtime)
	}
	lease, err := acquireProjectLease(project)
	if err != nil {
		return err
	}
	defer lease.Close()
	cmd := exec.Command(filepath.Join(packageRoot, "bin", name), args...)
	cmd.Dir = project
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	// BLINDAJE -> El shell conserva el descriptor durante el relevo y si muere el padre.
	cmd.ExtraFiles = []*os.File{lease}
	return cmd.Run()
}
