package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRuntimeLeaseHelper(t *testing.T) {
	if os.Getenv("N_EIN_TEST_RUNTIME_HELPER") != "1" {
		return
	}
	if err := run([]string{"--root", os.Getenv("N_EIN_TEST_RUNTIME_ROOT"), "--project", os.Getenv("N_EIN_TEST_RUNTIME_PROJECT"), "--runtime", "pi", "--", "probe"}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}

// Dos launchers independientes no pueden empezar a escribir en el mismo árbol.
func TestRuntimeLeaseAcrossProcesses(t *testing.T) {
	project, root := t.TempDir(), t.TempDir()
	if output, err := exec.Command("git", "-C", project, "init", "-b", "main").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v %s", err, output)
	}
	if err := os.MkdirAll(filepath.Join(root, "bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(project, "started")
	script := "#!/bin/sh\nprintf '%s\\n' \"$1\" >> started\nread -r done || true\n"
	if err := os.WriteFile(filepath.Join(root, "bin", "n-ein-dev"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	child := func() *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=^TestRuntimeLeaseHelper$")
		cmd.Env = append(os.Environ(), "N_EIN_TEST_RUNTIME_HELPER=1", "N_EIN_TEST_RUNTIME_ROOT="+root, "N_EIN_TEST_RUNTIME_PROJECT="+project)
		return cmd
	}
	first := child()
	input, err := first.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = input.Close(); _ = first.Process.Kill() })
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(marker); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("el primer runtime no arrancó")
		}
		time.Sleep(10 * time.Millisecond)
	}
	output, err := child().CombinedOutput()
	if err == nil || !strings.Contains(string(output), "RUNTIME_BUSY") {
		t.Fatalf("segundo launcher: err=%v output=%s", err, output)
	}
	content, _ := os.ReadFile(marker)
	if string(content) != "probe\n" {
		t.Fatalf("el segundo runtime llegó a escribir: %q", content)
	}
	// El runtime sigue vivo aunque muera su launcher: no debe quedar un escritor sin bloqueo.
	if err := first.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	time.Sleep(20 * time.Millisecond)
	output, err = child().CombinedOutput()
	if err == nil || !strings.Contains(string(output), "RUNTIME_BUSY") {
		t.Fatalf("runtime huérfano sin bloqueo: err=%v output=%s", err, output)
	}
	_ = input.Close()
	_ = first.Wait()
	deadline = time.Now().Add(5 * time.Second)
	for {
		output, err = child().CombinedOutput()
		if err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("lease no liberado: %v %s", err, output)
		}
		time.Sleep(10 * time.Millisecond)
	}
	content, _ = os.ReadFile(marker)
	if string(content) != "probe\nprobe\n" {
		t.Fatalf("tercer runtime: %q", content)
	}
}
