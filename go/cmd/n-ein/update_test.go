package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
	"time"

	"n_ein/internal/brand"
)

func TestNewerReleaseAsksOnceAndCaches(t *testing.T) {
	platform := runtime.GOOS + "-" + runtime.GOARCH
	calls, failing := 0, false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if failing {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		name := "n-ein-0.2.0-alpha.2-" + platform + ".tar.gz"
		fmt.Fprintf(w, `[{"tag_name":"v0.2.0-alpha.2","prerelease":true,"assets":[{"name":%q,"browser_download_url":"https://example.org/a"},{"name":%q,"browser_download_url":"https://example.org/b"}]}]`, name, name+".sha256")
	}))
	defer server.Close()
	t.Setenv("N_EIN_RELEASE_API", server.URL)
	t.Setenv("N_EIN_HOME", t.TempDir())
	now := time.Now()
	if got := newerRelease("preview", "0.1.0-preview.3", now); got != "0.2.0-alpha.2" {
		t.Fatalf("versión nueva no detectada: %q", got)
	}
	if got := newerRelease("preview", "0.2.0-alpha.2", now.Add(time.Minute)); got != "" || calls != 1 {
		t.Fatalf("la caché no evitó la consulta o avisó de la misma versión: %q, %d consultas", got, calls)
	}
	failing = true
	if got := newerRelease("preview", "0.1.0-preview.3", now.Add(updateCacheTTL+time.Minute)); got != "" {
		t.Fatalf("un fallo de la API no debe avisar: %q", got)
	}
	if got := newerRelease("dev", "checkout de desarrollo", now); got != "" || calls != 2 {
		t.Fatalf("el checkout de desarrollo no consulta releases: %q, %d", got, calls)
	}
}

func TestUpdateNoticeKeepsFocusAndOffersU(t *testing.T) {
	state := appState{
		menu: []menuItem{{"Pi", "", "p", "pi"}, {"Claude Code", "", "c", "claude"}},
		home: homeContext{channel: "preview", version: "0.1.0-preview.3"},
		views: []panel{
			{0, "INICIO", []row{{"Pi", "", "p", "pi"}, {"Claude Code", "", "c", "claude"}}},
			{4, "SISTEMA", []row{{"actualizaciones", "desconocido", "sin remoto", ""}}},
		},
	}
	m := newUIModel(state, homeView, false)
	updated, _ := m.Update(updateFound("0.2.0-alpha.2"))
	m = updated.(uiModel)
	if m.row != 1 || m.state.menu[m.row].action != "pi" {
		t.Fatalf("el aviso movió el foco: fila %d", m.row)
	}
	if got := m.state.views[1].rows[0].value; !strings.Contains(got, "0.2.0-alpha.2") {
		t.Fatalf("Sistema no anota la versión: %q", got)
	}
	drawn := renderHome(m.state, m.row, brand.Painter{}, screen{elapsed: brand.IntroSeconds, update: m.update})
	if !strings.Contains(drawn, "nueva versión 0.2.0-alpha.2") || !strings.Contains(drawn, "Actualizar") {
		t.Fatalf("la portada no avisa:\n%s", drawn)
	}
	updated, _ = m.Update(key('u', "u"))
	if updated.(uiModel).launch != "update" {
		t.Fatal("u no lanza la actualización")
	}
}

func TestBounceRisesAndRests(t *testing.T) {
	peak := 0
	for ms := 0; ms < 1500; ms += 20 {
		h := bounce(float64(ms) / 1000)
		if h < 0 || h > 2 {
			t.Fatalf("altura fuera de las tres filas: %d", h)
		}
		peak = max(peak, h)
	}
	if peak != 2 || bounce(3) != 0 {
		t.Fatalf("el aviso no bota y descansa: pico %d, reposo %d", peak, bounce(3))
	}
}
