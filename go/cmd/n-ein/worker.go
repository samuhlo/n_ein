// =============================================================================
// [FLOW] TRABAJADOR CON PROPIETARIO
// El pipe pertenece al padre. Al cerrarse detenemos el grupo y conservamos el
// bloqueo hasta su salida. Los comandos del hijo heredan el mismo descriptor:
// matar un supervisor no libera un árbol donde aún quedan escritores.
// =============================================================================
package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"
)

func runOwnedWorker(project, cwd string, args []string, input io.Reader, output, diagnostics io.Writer, inherited *os.File) error {
	if len(args) == 0 {
		return fmt.Errorf("WORKER_COMMAND: falta ejecutable")
	}
	lease := inherited
	if lease == nil {
		var err error
		lease, err = acquireProjectLease(project)
		if err != nil {
			return err
		}
	}
	defer lease.Close()
	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "N_EIN_LEASE_FD=3")
	cmd.ExtraFiles = []*os.File{lease}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Stdout, cmd.Stderr = output, diagnostics
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	if err = cmd.Start(); err != nil {
		return err
	}
	ended := make(chan error, 1)
	go func() { ended <- cmd.Wait() }()
	disconnected := make(chan struct{})
	go func() { _, _ = io.Copy(stdin, input); _ = stdin.Close(); close(disconnected) }()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGTERM, syscall.SIGINT, syscall.SIGHUP)
	defer signal.Stop(signals)
	var result error
	exited := false
	select {
	case result = <-ended:
		exited = true
	case <-disconnected:
		result = fmt.Errorf("WORKER_STOP: parent disconnected")
	case <-signals:
		result = fmt.Errorf("WORKER_STOP: signal")
	}
	// BLINDAJE -> La salida del líder no basta: también se detiene su grupo.
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	if !exited {
		select {
		case <-ended:
			exited = true
		case <-time.After(500 * time.Millisecond):
		}
	}
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	if !exited {
		select {
		case <-ended:
		case <-time.After(2 * time.Second):
			return fmt.Errorf("WORKER_STOP: exit unconfirmed")
		}
	}
	return result
}

func workerLeaseFromEnv() (*os.File, error) {
	if os.Getenv("N_EIN_LEASE_FD") == "" {
		return nil, nil
	}
	if os.Getenv("N_EIN_LEASE_FD") != "3" {
		return nil, fmt.Errorf("WORKER_LEASE: descriptor inválido")
	}
	f := os.NewFile(3, "n_ein-runtime.lock")
	if _, err := f.Stat(); err != nil {
		return nil, fmt.Errorf("WORKER_LEASE: %w", err)
	}
	return f, nil
}
