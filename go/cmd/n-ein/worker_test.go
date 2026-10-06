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
		done <- runOwnedWorker(dir, []string{"/bin/sh", "-c", "trap '' TERM; while :; do echo tick >> \"$1\"; sleep 0.03; done", "sh", output}, input, io.Discard, io.Discard, nil)
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
