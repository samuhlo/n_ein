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
