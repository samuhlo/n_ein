package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"io"
	"n_ein/internal/release"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestRemotePackageBeforeExecution(t *testing.T) {
	source, self, _, _ := sourceFixture(t)
	artifact := filepath.Join(t.TempDir(), "artifact")
	if err := packageArtifact(source, artifact, self, false, io.Discard); err != nil {
		t.Fatal(err)
	}
	var archive bytes.Buffer
	gz := gzip.NewWriter(&archive)
	tw := tar.NewWriter(gz)
	err := filepath.Walk(artifact, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return nil
		}
		rel, _ := filepath.Rel(artifact, path)
		h, _ := tar.FileInfoHeader(info, "")
		h.Name = "package/" + filepath.ToSlash(rel)
		if err := tw.WriteHeader(h); err != nil {
			return err
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		_, err = tw.Write(b)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	tw.Close()
	gz.Close()
	sum := fmt.Sprintf("%x", sha256.Sum256(archive.Bytes()))
	name := "n-ein-test.tar.gz"
	bad := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/sum" {
			hash := sum
			if bad {
				hash = fmt.Sprintf("%064d", 0)
			}
			fmt.Fprintf(w, "%s  %s\n", hash, name)
			return
		}
		w.Write(archive.Bytes())
	}))
	defer server.Close()
	candidate := release.Candidate{Version: version, Archive: server.URL + "/archive", Checksum: server.URL + "/sum", Name: name}
	if _, err := prepareRemote(candidate, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	bad = true
	area := t.TempDir()
	if _, err := prepareRemote(candidate, area); err == nil {
		t.Fatal("bad checksum accepted")
	}
	if _, err := os.Stat(filepath.Join(area, "package")); !os.IsNotExist(err) {
		t.Fatal("extracted before checking hash")
	}
	bad = false
	candidate.Version = "99.0.0"
	if _, err := prepareRemote(candidate, t.TempDir()); err == nil {
		t.Fatal("wrong manifest version accepted")
	}
}

func TestArtifactInstallsOnlyManifestFiles(t *testing.T) {
	source, self, target, _ := sourceFixture(t)
	artifact := filepath.Join(t.TempDir(), "artifact")
	if err := packageArtifact(source, artifact, self, false, io.Discard); err != nil {
		t.Fatal(err)
	}
	extra := filepath.Join(artifact, "pi-package/extensions/unlisted.ts")
	if err := os.WriteFile(extra, []byte("not in artifact manifest"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := install(artifact, target, "preview", self, false, false, io.Discard); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(target, "pi-package/extensions/unlisted.ts")); !os.IsNotExist(err) {
		t.Fatal("installed an undeclared file")
	}
}

func TestFetchWithoutArgumentsUsesPreviewUntilStable(t *testing.T) {
	platform := runtime.GOOS + "-" + runtime.GOARCH
	failing := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if failing {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		name := "n-ein-0.2.0-alpha.1-" + platform + ".tar.gz"
		fmt.Fprintf(w, `[{"tag_name":"v0.2.0-alpha.1","prerelease":true,"assets":[{"name":%q,"browser_download_url":"https://example.org/a"},{"name":%q,"browser_download_url":"https://example.org/b"}]}]`, name, name+".sha256")
	}))
	defer server.Close()
	t.Setenv("N_EIN_RELEASE_API", server.URL)
	t.Setenv("N_EIN_HOME", t.TempDir())
	var out bytes.Buffer
	if err := fetch([]string{"--dry-run"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "SIN STABLE") || !strings.Contains(out.String(), "0.2.0-alpha.1 · preview") {
		t.Fatalf("salida: %s", out.String())
	}
	if err := fetch([]string{"--channel", "stable", "--dry-run"}, io.Discard); err == nil {
		t.Fatal("un canal explícito cambió a preview")
	}
	failing = true
	if err := fetch([]string{"--dry-run"}, io.Discard); err == nil || strings.Contains(err.Error(), "preview") {
		t.Fatalf("un fallo de la API no debe convertirse en preview: %v", err)
	}
}
