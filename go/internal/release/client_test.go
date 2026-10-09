package release

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSelectPublishedCompleteRelease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("page") == "2" {
			fmt.Fprint(w, `[]`)
			return
		}
		fmt.Fprint(w, `[
 {"tag_name":"v0.2.0-alpha.10","prerelease":true,"draft":true},
 {"tag_name":"v0.2.0-alpha.9","prerelease":true,"assets":[]},
 {"tag_name":"v0.2.0-alpha.2","prerelease":true,"assets":[{"name":"n-ein-0.2.0-alpha.2-linux-amd64.tar.gz","browser_download_url":"https://example.org/a"},{"name":"n-ein-0.2.0-alpha.2-linux-amd64.tar.gz.sha256","browser_download_url":"https://example.org/b"}]},
 {"tag_name":"v0.2.0","assets":[{"name":"n-ein-0.2.0-linux-amd64.tar.gz","browser_download_url":"https://example.org/c"},{"name":"n-ein-0.2.0-linux-amd64.tar.gz.sha256","browser_download_url":"https://example.org/d"}]}]`)
	}))
	defer server.Close()
	c := Client{API: server.URL, HTTP: server.Client()}
	got, err := c.Select("preview", "", "linux-amd64")
	if err != nil || got.Version != "0.2.0-alpha.2" {
		t.Fatalf("%+v %v", got, err)
	}
	got, err = c.Select("stable", "", "linux-amd64")
	if err != nil || got.Version != "0.2.0" {
		t.Fatalf("%+v %v", got, err)
	}
	if _, err = c.Select("stable", "0.2.0-alpha.2", "linux-amd64"); err == nil {
		t.Fatal("stable accepted alpha")
	}
	if _, err = c.Select("preview", "", "darwin-arm64"); err == nil {
		t.Fatal("missing platform accepted")
	}
}
