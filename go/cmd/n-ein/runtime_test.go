package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestRuntimeHelper(t *testing.T) {
	if os.Getenv("N_EIN_TEST_RUNTIME_HELPER") != "1" {
		return
	}
	resumeFlag := "--resume"
	if os.Getenv("N_EIN_TEST_RUNTIME") == "pi" {
		resumeFlag = "--session"
	}
	if err := run([]string{"--root", os.Getenv("N_EIN_TEST_RUNTIME_ROOT"), "--project", os.Getenv("N_EIN_TEST_RUNTIME_PROJECT"), "--runtime", os.Getenv("N_EIN_TEST_RUNTIME"), "--", resumeFlag, "sesión con espacios"}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}

// Abrir otra conversación no depende de cerrar o recuperar la de otra terminal.
func TestConcurrentRuntimeSessions(t *testing.T) {
	for _, firstRuntime := range []string{"pi", "claude"} {
		for _, secondRuntime := range []string{"pi", "claude"} {
			for _, suspended := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s-%s/suspended=%t", firstRuntime, secondRuntime, suspended), func(t *testing.T) {
					project, root := runtimeFixture(t)
					child := func(runtime, marker string) *exec.Cmd {
						cmd := exec.Command(os.Args[0], "-test.run=^TestRuntimeHelper$")
						cmd.Env = append(os.Environ(), "N_EIN_TEST_RUNTIME_HELPER=1", "N_EIN_TEST_RUNTIME_ROOT="+root,
							"N_EIN_TEST_RUNTIME_PROJECT="+project, "N_EIN_TEST_RUNTIME="+runtime, "N_EIN_TEST_MARKER="+marker)
						return cmd
					}
					firstMarker, secondMarker := filepath.Join(project, "first"), filepath.Join(project, "second")
					first := child(firstRuntime, firstMarker)
					first.Env = append(first.Env, "N_EIN_TEST_HOLD=1")
					// Ctrl+Z suspende el grupo de la terminal, incluido el shell del runtime.
					first.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
					input, err := first.StdinPipe()
					if err != nil {
						t.Fatal(err)
					}
					if err := first.Start(); err != nil {
						_ = input.Close()
						t.Fatal(err)
					}
					t.Cleanup(func() {
						_ = syscall.Kill(-first.Process.Pid, syscall.SIGKILL)
						_ = input.Close()
						_ = first.Wait()
					})
					deadline := time.Now().Add(5 * time.Second)
					for {
						if _, err := os.Stat(firstMarker); err == nil {
							break
						}
						if time.Now().After(deadline) {
							t.Fatal("el primer runtime no arrancó")
						}
						time.Sleep(10 * time.Millisecond)
					}
					if suspended {
						if err := syscall.Kill(-first.Process.Pid, syscall.SIGSTOP); err != nil {
							t.Fatal(err)
						}
					}
					if output, err := child(secondRuntime, secondMarker).CombinedOutput(); err != nil {
						t.Fatalf("segunda sesión: %v %s", err, output)
					}
					content, err := os.ReadFile(secondMarker)
					resumeFlag := "--resume"
					if secondRuntime == "pi" {
						resumeFlag = "--session"
					}
					if err != nil || string(content) != resumeFlag+"\nsesión con espacios\n" {
						t.Fatalf("argumentos de continuación: %q, %v", content, err)
					}
					if err := first.Process.Signal(syscall.Signal(0)); err != nil {
						t.Fatalf("abrir otra sesión terminó la primera: %v", err)
					}
				})
			}
		}
	}
}

// Una sesión suspendida de una versión anterior tampoco veta un arranque nuevo.
func TestRuntimeIgnoresLegacyProjectLease(t *testing.T) {
	project, root := runtimeFixture(t)
	lease, err := acquireProjectLease(project)
	if err != nil {
		t.Fatal(err)
	}
	defer lease.Close()
	marker := filepath.Join(project, "started")
	t.Setenv("N_EIN_TEST_MARKER", marker)
	if err := launchRuntime(root, project, "claude", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("Claude no arrancó:", err)
	}
	if other, err := acquireProjectLease(project); err == nil {
		other.Close()
		t.Fatal("el launcher alteró el bloqueo de otro proceso")
	}
}

func TestRuntimeRejectsInvalidLaunch(t *testing.T) {
	project, root := runtimeFixture(t)
	marker := filepath.Join(project, "started")
	t.Setenv("N_EIN_TEST_MARKER", marker)
	if err := run([]string{"--root", root, "--project", project, "--runtime", "pi", "--once"}); err == nil {
		t.Fatal("--once no debe arrancar un runtime ni ignorarse")
	}
	if err := launchRuntime(root, project, "unknown", nil); err == nil || !strings.Contains(err.Error(), "runtime desconocido") {
		t.Fatalf("runtime no admitido: %v", err)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatalf("el runtime arrancó con argumentos inválidos: %v", err)
	}
}

func runtimeFixture(t *testing.T) (project, root string) {
	t.Helper()
	project, root = t.TempDir(), t.TempDir()
	if output, err := exec.Command("git", "-C", project, "init", "-b", "main").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v %s", err, output)
	}
	if err := os.MkdirAll(filepath.Join(root, "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "runtime.json"), []byte(`{"schema":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	script := "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$N_EIN_TEST_MARKER\"\nif [ \"${N_EIN_TEST_HOLD:-0}\" = 1 ]; then read -r done || true; fi\n"
	for _, name := range []string{"n-ein-dev", "n-ein-claude-dev"} {
		if err := os.WriteFile(filepath.Join(root, "bin", name), []byte(script), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	return project, root
}
