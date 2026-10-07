package main

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWorkerStopsWriterOnParentEOF(t *testing.T) {
	dir := t.TempDir()
	output := filepath.Join(dir, "ticks")
	input, parent := io.Pipe()
	done := make(chan error, 1)
	go func() {
		done <- runOwnedWorker(dir, dir, []string{"/bin/sh", "-c", "trap '' TERM; while :; do echo tick >> \"$1\"; sleep 0.03; done", "sh", output}, input, io.Discard, io.Discard, nil)
	}()
	deadline := time.Now().Add(4 * time.Second)
	for {
		if b, _ := os.ReadFile(output); len(b) > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("writer never started")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if lease, err := acquireProjectLease(dir); err == nil {
		lease.Close()
		t.Fatal("writer did not retain tree lease")
	}
	parent.Close()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not stop")
	}
	before, _ := os.ReadFile(output)
	time.Sleep(100 * time.Millisecond)
	after, _ := os.ReadFile(output)
	if !bytes.Equal(before, after) {
		t.Fatal("writer survived parent EOF")
	}
	lease, err := acquireProjectLease(dir)
	if err != nil {
		t.Fatal(err)
	}
	lease.Close()
}

func TestReaderHasOwnLeaseAndKeepsProjectCwd(t *testing.T) {
	project, ownership := t.TempDir(), t.TempDir()
	writer, err := acquireProjectLease(project)
	if err != nil {
		t.Fatal(err)
	}
	defer writer.Close()
	input, parent := io.Pipe()
	defer parent.Close()
	var output bytes.Buffer
	done := make(chan error, 1)
	go func() {
		done <- runOwnedWorker(ownership, project, []string{"/bin/sh", "-c", "pwd -P; sleep 0.1"}, input, &output, io.Discard, nil)
	}()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("reader blocked by writer")
	}
	canonical, _ := filepath.EvalSymlinks(project)
	if output.String() != canonical+"\n" {
		t.Fatalf("wrong reader cwd: %q", output.String())
	}
	if lease, err := acquireProjectLease(ownership); err != nil {
		t.Fatal(err)
	} else {
		lease.Close()
	}
	if lease, err := acquireProjectLease(project); err == nil {
		lease.Close()
		t.Fatal("reader released writer ownership")
	}
}
