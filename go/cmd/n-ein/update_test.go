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

func TestNoticeBlinksTwiceThenStays(t *testing.T) {
	changes := 0
	for ms, last := 0, true; ms < 2000; ms += 20 {
		on := blink(float64(ms) / 1000)
		if on != last {
			changes++
		}
		last = on
	}
	if changes != 4 || !blink(0) || !blink(5) {
		t.Fatalf("el aviso debe apagarse y volver dos veces y quedarse fijo: %d cambios", changes)
	}
}

func TestNoticeKeepsMenuStillAndStopsTicking(t *testing.T) {
	state := appState{
		menu:  []menuItem{{"Pi", "", "p", "pi"}},
		home:  homeContext{name: "demo", channel: "preview", version: "0.1.0"},
		views: []panel{{0, "INICIO", []row{{"Pi", "", "p", "pi"}}}},
	}
	on := renderHome(state, 0, brand.Painter{}, screen{elapsed: brand.IntroSeconds, update: "0.2.0"})
	off := renderHome(state, 0, brand.Painter{}, screen{elapsed: brand.IntroSeconds, update: "0.2.0", blinkOff: true})
	if strings.Contains(off, "nueva versión") || strings.Count(on, "\n") != strings.Count(off, "\n") {
		t.Fatalf("el parpadeo mueve la portada:\n%s\n---\n%s", on, off)
	}
	row := func(drawn string) int { return strings.Count(drawn[:strings.Index(drawn, "▸ Pi")], "\n") }
	if row(on) != row(off) {
		t.Fatal("el menú cambia de sitio con el parpadeo")
	}
	m := newUIModel(state, homeView, false)
	updated, cmd := m.Update(updateFound("0.2.0"))
	if cmd == nil {
		t.Fatal("el aviso no arranca su parpadeo")
	}
	m = updated.(uiModel)
	if _, cmd = m.Update(introTick(m.noticeAt.Add(2 * time.Second))); cmd != nil {
		t.Fatal("el aviso sigue animándose después de parpadear")
	}
}

func TestHomeShowsInstalledVersion(t *testing.T) {
	state := appState{home: homeContext{name: "demo", channel: "preview", version: "0.3.0-alpha.5"}}
	if drawn := renderHome(state, 0, brand.Painter{}, screen{elapsed: brand.IntroSeconds}); !strings.Contains(drawn, "n_ein 0.3.0-alpha.5 · preview") {
		t.Fatalf("la portada no dice qué versión está instalada:\n%s", drawn)
	}
}
