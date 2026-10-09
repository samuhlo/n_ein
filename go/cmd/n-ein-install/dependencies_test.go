package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestDependenciesVerifiedAndRepairable(t *testing.T) {
	var data bytes.Buffer
	z := zip.NewWriter(&data)
	f, _ := z.Create("bun-test/bun")
	f.Write([]byte("#!/bin/sh\necho 1.3.14\n"))
	z.Close()
	sum := sha256.Sum256(data.Bytes())
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(data.Bytes()) }))
	defer server.Close()
	source := t.TempDir()
	home := t.TempDir()
	t.Setenv("N_EIN_HOME", home)
	pin := map[string]any{"version": "1.3.14", "assets": map[string]any{runtime.GOOS + "-" + runtime.GOARCH: map[string]string{"url": server.URL + "/bun.zip", "sha256": hex.EncodeToString(sum[:]), "member": "bun-test/bun", "format": "zip"}}}
	config := map[string]any{"bun": pin}
	save := func() { b, _ := json.Marshal(config); os.WriteFile(filepath.Join(source, "runtime.json"), b, 0600) }
	save()
	target := filepath.Join(home, "runtimes/bun/1.3.14/bin/bun")
	if err := installDependencies(source, true, io.Discard); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("dry run wrote binary")
	}
	if err := installDependencies(source, false, io.Discard); err != nil {
		t.Fatal(err)
	}
	before, _ := os.Stat(target)
	if err := installDependencies(source, false, io.Discard); err != nil {
		t.Fatal(err)
	}
	after, _ := os.Stat(target)
	if before.ModTime() != after.ModTime() {
		t.Fatal("reinstalled valid dependency")
	}
	os.WriteFile(target, []byte("broken"), 0700)
	if err := installDependencies(source, false, io.Discard); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(target); !bytes.Contains(b, []byte("1.3.14")) {
		t.Fatal("not repaired")
	}
	pin["version"] = "1.3.15"
	save()
	if err := installDependencies(source, false, io.Discard); err == nil {
		t.Fatal("wrong version accepted")
	}
	if _, err := os.Stat(filepath.Join(home, "runtimes/bun/1.3.15")); !os.IsNotExist(err) {
		t.Fatal("failed stage promoted")
	}
}
