package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	tea "charm.land/bubbletea/v2"

	"n_ein/internal/layout"
	"n_ein/internal/release"
)

// =============================================================================
// [FLOW] AVISO DE VERSIÓN NUEVA
// El launcher pregunta a las releases de su canal en segundo plano: la portada
// nunca espera a la red. La respuesta se guarda unas horas porque la API de
// GitHub sin token admite 60 consultas por hora y por IP.
// =============================================================================

const updateCacheTTL = 6 * time.Hour

type updateFound string

type updateCache struct {
	Checked time.Time `json:"checked"`
	Latest  string    `json:"latest"`
}

// newerRelease devuelve la última versión del canal si supera a la instalada; "" en cualquier otro caso.
func newerRelease(channel, installed string, now time.Time) string {
	current, err := release.Parse(installed)
	if err != nil || (channel != "preview" && channel != "stable") {
		return ""
	}
	latest := ""
	cachePath := ""
	if root, err := layout.Root(); err == nil {
		cachePath = filepath.Join(root, "cache", "update-"+channel+".json")
	}
	var cached updateCache
	if data, err := os.ReadFile(cachePath); err == nil && json.Unmarshal(data, &cached) == nil && now.Sub(cached.Checked) < updateCacheTTL {
		latest = cached.Latest
	} else {
		client := release.Client{API: os.Getenv("N_EIN_RELEASE_API"), HTTP: &http.Client{Timeout: 4 * time.Second}}
		chosen, err := client.Select(channel, "", runtime.GOOS+"-"+runtime.GOARCH)
		if err != nil {
			// Sin red o sin release no hay aviso; tampoco se guarda, para reintentar en la próxima apertura.
			return ""
		}
		latest = chosen.Version
		if data, err := json.Marshal(updateCache{Checked: now, Latest: latest}); err == nil && cachePath != "" {
			if os.MkdirAll(filepath.Dir(cachePath), 0o700) == nil {
				_ = os.WriteFile(cachePath, data, 0o600)
			}
		}
	}
	next, err := release.Parse(latest)
	if err != nil || next.Compare(current) <= 0 {
		return ""
	}
	return latest
}

func checkUpdate(channel, installed string) tea.Cmd {
	return func() tea.Msg {
		if version := newerRelease(channel, installed, time.Now()); version != "" {
			return updateFound(version)
		}
		return nil
	}
}

// withUpdate pone «Actualizar» en cabeza del menú y lo anota en Sistema.
func withUpdate(state appState, version string) appState {
	item := menuItem{"Actualizar", "→ " + version, "u", "update"}
	state.menu = append([]menuItem{item}, state.menu...)
	views := append([]panel(nil), state.views...)
	homeRows := []row{{item.label, item.note, item.key, item.action}}
	views[homeView].rows = append(homeRows, views[homeView].rows...)
	for i, panel := range views {
		rows := append([]row(nil), panel.rows...)
		for j, item := range rows {
			if item.label == "actualizaciones" {
				rows[j] = row{"actualizaciones", version + " disponible · u en la portada", "releases " + state.home.channel, "update"}
			}
		}
		views[i].rows = rows
	}
	state.views = views
	return state
}

// blinkSeconds es lo que dura el parpadeo; después el aviso queda fijo y la portada deja de redibujarse.
const blinkSeconds = 1.2

// blink dice si el aviso se ve: aparece, se apaga y vuelve dos veces, y se queda.
func blink(seconds float64) bool {
	return seconds >= blinkSeconds || int(seconds/0.3)%2 == 0
}
